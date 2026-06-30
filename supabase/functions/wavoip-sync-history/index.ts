import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Poll de segurança: para cada dispositivo Wavoip conectado, busca o histórico
// recente de chamadas na API Wavoip e faz upsert em `wavoip_call_logs`.
// Dispara `wavoip-fetch-recording` para chamadas terminadas sem gravação.
// Body opcional: { device_token?: string; client_id?: number; limit?: number }

const WAVOIP_API = 'https://api.wavoip.com';

function normalizeDirection(raw: any): 'inbound' | 'outbound' {
  const r = String(raw ?? '').toLowerCase();
  if (r.includes('in')) return 'inbound';
  return 'outbound';
}

function pickStr(...vals: any[]): string | null {
  for (const v of vals) if (v != null && String(v).length > 0) return String(v);
  return null;
}

function pickNum(...vals: any[]): number {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

async function fetchDeviceCalls(token: string, limit: number): Promise<any[]> {
  // Tenta endpoints conhecidos da Wavoip — o token do dispositivo é a auth.
  // Mantém múltiplas variações por segurança caso a doc evolua.
  const candidates = [
    `${WAVOIP_API}/calls?limit=${limit}`,
    `${WAVOIP_API}/v1/calls?limit=${limit}`,
    `${WAVOIP_API}/devices/calls?limit=${limit}`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!res.ok) continue;
      const json = await res.json().catch(() => null);
      const list = Array.isArray(json) ? json
        : Array.isArray((json as any)?.data) ? (json as any).data
        : Array.isArray((json as any)?.calls) ? (json as any).calls
        : Array.isArray((json as any)?.items) ? (json as any).items
        : [];
      if (list.length || res.status === 200) return list;
    } catch (e) {
      console.warn('[wavoip-sync-history] fetch failed', url, e);
    }
  }
  return [];
}

async function triggerFetchRecording(supabaseUrl: string, serviceKey: string, whatsapp_call_id: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/wavoip-fetch-recording`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      body: JSON.stringify({ whatsapp_call_id }),
    });
  } catch (e) { console.warn('[wavoip-sync-history] trigger rec failed', e); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({} as any));
    const limit = Math.min(Number(body?.limit) || 50, 200);

    // Seleciona dispositivos a sincronizar
    let dq = admin.from('wavoip_devices').select('id,device_token,client_id,user_id,app_user_id,connection_status');
    if (body?.device_token) dq = dq.eq('device_token', String(body.device_token));
    else if (body?.client_id) dq = dq.eq('client_id', Number(body.client_id));
    else dq = dq.eq('connection_status', 'connected');
    const { data: devices, error: devErr } = await dq;
    if (devErr) throw devErr;

    const summary: any[] = [];
    for (const dev of devices ?? []) {
      const calls = await fetchDeviceCalls(dev.device_token, limit);
      let upserts = 0;
      let triggered = 0;
      for (const c of calls) {
        const wid = pickStr(c?.whatsapp_call_id, c?.id, c?.call_id);
        if (!wid) continue;
        const direction = normalizeDirection(c?.direction);
        const status = String(c?.status ?? 'ended').toLowerCase();
        const row = {
          whatsapp_call_id: wid,
          device_id: dev.id,
          client_id: dev.client_id,
          app_user_id: dev.app_user_id,
          user_id: dev.user_id,
          direction,
          status,
          from_number: pickStr(c?.from, c?.caller, c?.from_number),
          to_number: pickStr(c?.to, c?.receiver, c?.to_number),
          whatsapp_jid: pickStr(c?.jid, c?.whatsapp_jid),
          started_at: c?.started_at ?? c?.start_at ?? null,
          answered_at: c?.answered_at ?? null,
          ended_at: c?.ended_at ?? c?.end_at ?? null,
          duration_seconds: pickNum(c?.duration, c?.duration_seconds),
          end_reason: pickStr(c?.end_reason, c?.reason),
          metadata: { source: 'sync-history', payload: c },
        };
        const { error: upErr, data: upRow } = await admin
          .from('wavoip_call_logs')
          .upsert(row, { onConflict: 'whatsapp_call_id' })
          .select('id,recording_status,recording_url,ended_at')
          .single();
        if (upErr) { console.warn('[wavoip-sync-history] upsert err', upErr.message); continue; }
        upserts++;
        const terminal = upRow?.ended_at || ['ended', 'rejected', 'not_answered', 'failed', 'handled_remotely'].includes(status);
        if (terminal && upRow?.recording_status !== 'available') {
          // @ts-ignore EdgeRuntime
          const wait = (globalThis as any)?.EdgeRuntime?.waitUntil ?? ((p: Promise<unknown>) => p);
          wait(triggerFetchRecording(supabaseUrl, serviceKey, wid));
          triggered++;
        }
      }
      summary.push({ device_token: dev.device_token, fetched: calls.length, upserts, recording_triggers: triggered });
    }

    return new Response(JSON.stringify({ ok: true, devices: summary }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});