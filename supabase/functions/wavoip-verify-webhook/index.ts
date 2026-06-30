import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Verifica para cada dispositivo Wavoip se o webhook está habilitado e
// apontando para nosso endpoint wavoip-call-webhook. Persiste o resultado em
// wavoip_devices.webhook_status ('ok' | 'misconfigured' | 'disabled' | 'unknown' | 'error').
// Se auto_fix=true (default), reconfigura automaticamente os que estiverem errados.

const WAVOIP_API = 'https://api.wavoip.com';

async function fetchWebhook(token: string): Promise<{ ok: boolean; data?: any; error?: string }> {
  const tries = [
    `${WAVOIP_API}/devices/info`,
    `${WAVOIP_API}/devices/me`,
    `${WAVOIP_API}/devices`,
    `${WAVOIP_API}/devices/webhook`,
    `${WAVOIP_API}/v1/devices/webhook`,
    `${WAVOIP_API}/webhook`,
  ];
  let lastErr = '';
  for (const url of tries) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      });
      const txt = await res.text();
      if (res.ok) {
        try { return { ok: true, data: JSON.parse(txt) }; }
        catch { return { ok: true, data: txt }; }
      }
      lastErr = `${res.status} ${txt}`;
    } catch (e) {
      lastErr = String((e as Error)?.message ?? e);
    }
  }
  return { ok: false, error: lastErr };
}

function evaluate(payload: any, expectedUrl: string): { status: 'ok' | 'misconfigured' | 'disabled' | 'unknown'; actualUrl: string | null; enabled: boolean | null } {
  if (!payload) return { status: 'unknown', actualUrl: null, enabled: null };
  // tenta achar a sub-estrutura do webhook em vários formatos
  const candidates: any[] = [payload, payload?.data, payload?.device, payload?.webhook, payload?.data?.webhook, payload?.device?.webhook];
  let node: any = null;
  for (const c of candidates) {
    if (c && (c.url || c.webhook_url || c.callback || c.webhook)) { node = c.webhook ?? c; break; }
  }
  if (!node) return { status: 'unknown', actualUrl: null, enabled: null };
  const actualUrl: string | null = node?.url ?? node?.webhook_url ?? node?.callback ?? null;
  const enabledRaw = node?.enabled ?? node?.active ?? node?.is_enabled;
  const enabled = typeof enabledRaw === 'boolean' ? enabledRaw : (enabledRaw == null ? null : Boolean(enabledRaw));
  if (!actualUrl) return { status: 'unknown', actualUrl: null, enabled };
  if (enabled === false) return { status: 'disabled', actualUrl, enabled: false };
  const norm = (u: string) => u.split('?')[0].replace(/\/+$/, '');
  if (norm(actualUrl) !== norm(expectedUrl)) return { status: 'misconfigured', actualUrl, enabled };
  return { status: 'ok', actualUrl, enabled: enabled ?? true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({} as any));
    const autoFix = body?.auto_fix !== false; // default true

    let q = admin.from('wavoip_devices').select('id,device_token,client_id,connection_status');
    if (body?.device_token) q = q.eq('device_token', String(body.device_token));
    else if (body?.client_id) q = q.eq('client_id', Number(body.client_id));
    else q = q.eq('connection_status', 'connected');
    const { data: devices, error } = await q;
    if (error) throw error;

    const results: any[] = [];
    for (const d of devices ?? []) {
      const expected = `${supabaseUrl}/functions/v1/wavoip-call-webhook?device_token=${encodeURIComponent(d.device_token)}`;
      const r = await fetchWebhook(d.device_token);
      let status: 'ok' | 'misconfigured' | 'disabled' | 'unknown' | 'error' = 'error';
      let actualUrl: string | null = null;
      let lastError: string | null = null;
      if (!r.ok) {
        // GET indisponível na API → não conseguimos validar diretamente; cairemos no auto_fix abaixo
        status = 'unknown';
        lastError = r.error ?? 'fetch_failed';
      } else {
        const ev = evaluate(r.data, expected);
        status = ev.status;
        actualUrl = ev.actualUrl;
      }

      // Auto-fix se necessário
      if (autoFix && (status === 'misconfigured' || status === 'disabled' || status === 'unknown')) {
        try {
          const fixRes = await fetch(`${supabaseUrl}/functions/v1/wavoip-configure-webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
            body: JSON.stringify({ device_token: d.device_token }),
          });
          const fixJson = await fixRes.json().catch(() => ({}));
          const fixed = Array.isArray(fixJson?.configured) && fixJson.configured.every((x: any) => x.ok);
          if (fixed) {
            // configure aceitou → assumimos OK; salva o endpoint usado para referência
            status = 'ok';
            actualUrl = expected;
            lastError = null;
          } else {
            lastError = `auto_fix_failed: ${JSON.stringify(fixJson)}`.slice(0, 500);
          }
        } catch (e) {
          lastError = `auto_fix_exception: ${String((e as Error)?.message ?? e)}`.slice(0, 500);
        }
      }

      await admin.from('wavoip_devices').update({
        webhook_status: status,
        webhook_url: actualUrl,
        webhook_checked_at: new Date().toISOString(),
        webhook_last_error: lastError,
      }).eq('id', d.id);

      results.push({ device_id: d.id, status, actualUrl, expected, lastError });
    }

    return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});