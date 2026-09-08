import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Configura automaticamente o Webhook oficial da Wavoip apontando para
// /functions/v1/wavoip-call-webhook?device_token=<token>, com eventos CALL,RECORD,DEVICE.
// Body: { device_token?: string; client_id?: number } — sem device_token, aplica em todos
// os dispositivos do cliente (ou conectados, se nenhum critério).

const WAVOIP_API = 'https://api.wavoip.com';

const tokenCache = new Map<string, { jwt: string; apiBase: string }>();
async function getProviderToken(supabaseUrl: string, serviceKey: string, providerId: string) {
  const cached = tokenCache.get(providerId);
  if (cached) return cached;
  const res = await fetch(`${supabaseUrl}/functions/v1/wavoip-providers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    body: JSON.stringify({ action: 'get_token', data: { id: providerId } }),
  });
  const json = await res.json().catch(() => ({} as any));
  const jwt: string | null = json?.data?.token ?? null;
  if (!jwt) throw new Error('provider_token_unavailable');
  const out = { jwt, apiBase: String(json?.data?.api_base || WAVOIP_API).replace(/\/$/, '') };
  tokenCache.set(providerId, out);
  return out;
}

// API oficial (WAV Painel): PUT/POST /devices/:device_id/webhook com JWT do provedor.
async function configureOne(apiBase: string, jwt: string, wavoipDeviceId: string, callbackUrl: string): Promise<{ ok: boolean; endpoint?: string; error?: string }> {
  const body = { url: callbackUrl, events: ['CALL', 'RECORD', 'DEVICE'], enabled: true, active: true };
  const tries: Array<{ method: string; url: string }> = [
    { method: 'PUT',  url: `${apiBase}/devices/${encodeURIComponent(wavoipDeviceId)}/webhook` },
    { method: 'POST', url: `${apiBase}/devices/${encodeURIComponent(wavoipDeviceId)}/webhook` },
  ];
  let lastErr = '';
  for (const t of tries) {
    try {
      const res = await fetch(t.url, {
        method: t.method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}`, 'Accept': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) return { ok: true, endpoint: `${t.method} ${t.url}` };
      lastErr = `${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`;
    } catch (e) {
      lastErr = String((e as Error)?.message ?? e);
    }
  }
  return { ok: false, error: lastErr };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({} as any));

    let q = admin.from('wavoip_devices').select('id,device_token,client_id,connection_status,provider_id,wavoip_device_id,device_name,webhook_status');
    if (body?.device_token) q = q.eq('device_token', String(body.device_token));
    else if (body?.client_id) q = q.eq('client_id', Number(body.client_id));
    else q = q.eq('connection_status', 'connected');
    const { data: devices, error } = await q;
    if (error) throw error;

    const out: any[] = [];
    for (const d of devices ?? []) {
      const callback = `${supabaseUrl}/functions/v1/wavoip-call-webhook?device_token=${encodeURIComponent(d.device_token)}`;
      let r: { ok: boolean; endpoint?: string; error?: string };
      if (!d.provider_id || !d.wavoip_device_id) {
        r = { ok: false, error: 'Dispositivo sem provider_id/wavoip_device_id' };
      } else {
        try {
          const { jwt, apiBase } = await getProviderToken(supabaseUrl, serviceKey, d.provider_id);
          r = await configureOne(apiBase, jwt, String(d.wavoip_device_id), callback);
        } catch (e) {
          r = { ok: false, error: String((e as Error)?.message ?? e) };
        }
      }
      console.log(`[wavoip-configure-webhook] device=${d.device_name} ok=${r.ok} ${r.endpoint ?? r.error ?? ''}`);
      // Registra resultado; não rebaixa status quando o webhook já está entregando eventos.
      const patch: any = { webhook_url: callback, webhook_checked_at: new Date().toISOString() };
      if (r.ok) {
        if (d.webhook_status !== 'ok') patch.webhook_status = 'registered';
        patch.webhook_last_error = null;
      } else {
        patch.webhook_last_error = `Falha ao registrar webhook na Wavoip: ${r.error}`;
      }
      await admin.from('wavoip_devices').update(patch).eq('id', d.id);
      out.push({ device_id: d.id, device: d.device_name, ...r });
    }
    return new Response(JSON.stringify({ ok: true, configured: out }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
