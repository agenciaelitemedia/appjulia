import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { pickCustomerNumber, resolveContactLink } from '../_shared/contact-link.ts';

// Poll de segurança: para cada dispositivo Wavoip, busca o histórico oficial de
// chamadas em GET {api_base}/v2/devices/{wavoip_device_id}/calls (JWT do provedor)
// e faz upsert em `wavoip_call_logs`. Também enfileira reconciliação para
// registros presos em status não terminal.
// Body opcional: { device_token?: string; client_id?: number; limit?: number; include_disconnected?: boolean }

const WAVOIP_API = 'https://api.wavoip.com';
const STALE_MS = 15 * 60_000;
const TERMINAL = new Set(['ended', 'cancelled', 'rejected', 'not_answered', 'failed', 'handled_remotely', 'missed']);

const STATUS_CANON: Record<string, string> = {
  CALLING: 'calling', OUTGOING_CALLING: 'calling',
  RINGING: 'ringing', INCOMING_RING: 'ringing', OUTGOING_RING: 'ringing',
  CONNECTING: 'connecting',
  ACTIVE: 'active', ACCEPT: 'active', ACCEPTED: 'active',
  ENDED: 'ended', CANCELLED: 'cancelled', REJECTED: 'rejected',
  NOT_ANSWERED: 'not_answered', FAILED: 'failed',
  HANDLED_REMOTELY: 'handled_remotely', MISSED: 'missed',
};

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
function toIso(v: any): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

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

function extractList(json: any): any[] {
  return Array.isArray(json) ? json
    : Array.isArray(json?.result) ? json.result
    : Array.isArray(json?.data) ? json.data
    : Array.isArray(json?.data?.calls) ? json.data.calls
    : Array.isArray(json?.data?.result) ? json.data.result
    : Array.isArray(json?.calls) ? json.calls
    : Array.isArray(json?.items) ? json.items
    : [];
}

/**
 * A Wavoip expõe o histórico do dispositivo em mais de um formato (V2 com JWT do
 * provedor, painel com id ou token do dispositivo). Tentamos as variantes conhecidas
 * até obter 2xx, registrando qual funcionou.
 */
async function fetchDeviceCalls(
  apiBase: string, jwt: string, wavoipDeviceId: string, deviceToken: string | null, limit: number,
): Promise<{ list: any[]; status: number; error?: string; variant?: string }> {
  const id = encodeURIComponent(wavoipDeviceId);
  const tok = deviceToken ? encodeURIComponent(deviceToken) : null;
  const variants: Array<{ name: string; url: string; headers: Record<string, string> }> = [
    { name: 'v2_id_jwt', url: `${apiBase}/v2/devices/${id}/calls?limit=${limit}`, headers: { Authorization: `Bearer ${jwt}` } },
    { name: 'panel_id_jwt', url: `${apiBase}/devices/${id}/calls?limit=${limit}`, headers: { Authorization: `Bearer ${jwt}` } },
  ];
  if (tok) {
    variants.push(
      { name: 'v2_token_jwt', url: `${apiBase}/v2/devices/${tok}/calls?limit=${limit}`, headers: { Authorization: `Bearer ${jwt}` } },
      { name: 'v2_id_devtoken', url: `${apiBase}/v2/devices/${id}/calls?limit=${limit}`, headers: { Authorization: `Bearer ${deviceToken}` } },
      { name: 'v2_token_devtoken', url: `${apiBase}/v2/devices/${tok}/calls?limit=${limit}`, headers: { Authorization: `Bearer ${deviceToken}` } },
      { name: 'panel_token_header', url: `${apiBase}/devices/${id}/calls?limit=${limit}`, headers: { Authorization: `Bearer ${jwt}`, token: deviceToken! } },
    );
  }
  let last: { status: number; error: string } = { status: 0, error: 'no_variant' };
  for (const v of variants) {
    try {
      const res = await fetch(v.url, { headers: { ...v.headers, Accept: 'application/json' } });
      const json: any = await res.json().catch(() => null);
      if (res.ok) {
        const list = extractList(json);
        if (!list.length && json) console.log(`[wavoip-sync-history] ${v.name} ok but unexpected shape keys=`, Object.keys(json));
        return { list, status: res.status, variant: v.name };
      }
      last = { status: res.status, error: JSON.stringify(json ?? '').slice(0, 300) };
      // 404/401/403: tenta a próxima variante; outros erros (5xx) param aqui.
      if (![401, 403, 404].includes(res.status)) break;
    } catch (e) {
      last = { status: 0, error: String((e as Error)?.message ?? e) };
    }
  }
  return { list: [], ...last };
}

async function triggerFetchRecording(supabaseUrl: string, serviceKey: string, whatsapp_call_id: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/wavoip-fetch-recording`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey },
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
    const limit = Math.min(Number(body?.limit) || 100, 500);

    // Seleciona dispositivos: filtro explícito, ou conectados + com atividade nos últimos 30 dias.
    let dq = admin.from('wavoip_devices').select('id,device_token,client_id,user_id,app_user_id,connection_status,provider_id,wavoip_device_id,device_name');
    if (body?.device_token) dq = dq.eq('device_token', String(body.device_token));
    else if (body?.client_id) dq = dq.eq('client_id', Number(body.client_id));
    const { data: allDevices, error: devErr } = await dq;
    if (devErr) throw devErr;

    let devices = allDevices ?? [];
    if (!body?.device_token && !body?.client_id && !body?.include_disconnected) {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data: active } = await admin.from('wavoip_call_logs').select('device_id').gte('created_at', since);
      const activeIds = new Set((active ?? []).map((r: any) => r.device_id));
      devices = devices.filter((d: any) => d.connection_status === 'connected' || activeIds.has(d.id));
    }

    const summary: any[] = [];
    const wait = (globalThis as any)?.EdgeRuntime?.waitUntil ?? ((p: Promise<unknown>) => p);

    for (const dev of devices) {
      if (!dev.provider_id || !dev.wavoip_device_id) {
        summary.push({ device: dev.device_name, skipped: 'sem provider_id/wavoip_device_id' });
        continue;
      }
      let calls: any[] = [];
      try {
        const { jwt, apiBase } = await getProviderToken(supabaseUrl, serviceKey, dev.provider_id);
        const r = await fetchDeviceCalls(apiBase, jwt, String(dev.wavoip_device_id), limit);
        if (r.error) {
          console.warn(`[wavoip-sync-history] device=${dev.device_name} http=${r.status} ${r.error}`);
          summary.push({ device: dev.device_name, error: `http_${r.status}`, body: r.error });
          continue;
        }
        calls = r.list;
      } catch (e) {
        console.warn(`[wavoip-sync-history] device=${dev.device_name} err`, e);
        summary.push({ device: dev.device_name, error: String((e as Error)?.message ?? e) });
        continue;
      }

      let upserts = 0, triggered = 0, errors = 0;
      for (const c of calls) {
        const wid = pickStr(c?.whatsapp_call_id, c?.call_id, c?.id_whatsapp, c?.id);
        if (!wid) continue;
        const rawStatus = String(c?.status ?? 'NONE').toUpperCase();
        const status = STATUS_CANON[rawStatus] ?? rawStatus.toLowerCase();
        const rawDir = String(c?.direction ?? 'OUTCOMING').toUpperCase();
        const direction = rawDir.startsWith('IN') ? 'inbound' : 'outbound';
        const durationSec = Math.round(pickNum(c?.duration, c?.duration_seconds));
        const startedAt = toIso(c?.created_date ?? c?.started_at ?? c?.start_at);
        const endedAt = toIso(c?.last_updated_date ?? c?.ended_at ?? c?.end_at);

        const { data: existing } = await admin.from('wavoip_call_logs')
          .select('id,device_id,client_id,app_user_id,user_id,recording_status,recording_url,answered_at,metadata')
          .eq('whatsapp_call_id', wid).maybeSingle();

        const row: any = {
          whatsapp_call_id: wid,
          device_id: existing?.device_id ?? dev.id,
          client_id: existing?.client_id ?? dev.client_id,
          app_user_id: existing?.app_user_id ?? dev.app_user_id,
          user_id: existing?.user_id ?? dev.user_id,
          direction,
          status,
          from_number: pickStr(c?.caller, c?.from, c?.from_number),
          to_number: pickStr(c?.receiver, c?.to, c?.to_number),
          whatsapp_jid: pickStr(c?.jid, c?.whatsapp_jid) ?? undefined,
          started_at: startedAt,
          answered_at: existing?.answered_at ?? (durationSec > 0 ? startedAt : null),
          ended_at: TERMINAL.has(status) ? (endedAt ?? startedAt) : endedAt,
          duration_seconds: durationSec,
          end_reason: rawStatus,
          metadata: { ...((existing?.metadata as any) ?? {}), source: 'sync-history', payload: c, synced_at: new Date().toISOString() },
        };
        if (existing?.recording_status) row.recording_status = existing.recording_status;
        if (existing?.recording_url) row.recording_url = existing.recording_url;

        try {
          const customerNumber = direction === 'inbound'
            ? pickCustomerNumber(row.from_number, row.to_number)
            : pickCustomerNumber(row.to_number, row.from_number);
          const link = await resolveContactLink(admin, row.client_id, customerNumber, { withConversation: true });
          row.contact_phone_e164 = link.contact_phone_e164;
          if (link.contact_id) row.contact_id = link.contact_id;
          if (link.conversation_id) row.conversation_id = link.conversation_id;
        } catch (e) { console.warn('[wavoip-sync-history] contact link failed', e); }

        const { error: upErr, data: upRow } = await admin
          .from('wavoip_call_logs')
          .upsert(row, { onConflict: 'whatsapp_call_id' })
          .select('id,recording_status,ended_at')
          .single();
        if (upErr) { errors++; console.warn('[wavoip-sync-history] upsert err', upErr.message); continue; }
        upserts++;
        const recReady = String(c?.record_status ?? '').toUpperCase() === 'READY';
        if (TERMINAL.has(status) && durationSec > 0 && recReady && upRow?.recording_status !== 'available') {
          wait(triggerFetchRecording(supabaseUrl, serviceKey, wid));
          triggered++;
        }
      }
      console.log(`[wavoip-sync-history] device=${dev.device_name} fetched=${calls.length} upserts=${upserts} errors=${errors}`);
      summary.push({ device: dev.device_name, fetched: calls.length, upserts, errors, recording_triggers: triggered });
    }

    // Registros presos em status não terminal há mais de 15 min → fila de reconciliação.
    const deviceIds = devices.map((d: any) => d.id);
    let stuckQueued = 0;
    if (deviceIds.length) {
      const staleBefore = new Date(Date.now() - STALE_MS).toISOString();
      const { data: stuck } = await admin.from('wavoip_call_logs')
        .select('whatsapp_call_id,status')
        .in('device_id', deviceIds)
        .is('ended_at', null)
        .lt('created_at', staleBefore)
        .not('whatsapp_call_id', 'is', null)
        .limit(200);
      const rows = (stuck ?? []).filter((r: any) => !TERMINAL.has(String(r.status)));
      if (rows.length) {
        const now = new Date().toISOString();
        const { error: qErr } = await admin.from('wavoip_reconcile_queue').upsert(
          rows.map((r: any) => ({ whatsapp_call_id: r.whatsapp_call_id, run_after: now, attempts: 0, status: 'pending', updated_at: now })),
          { onConflict: 'whatsapp_call_id' } as any,
        );
        if (!qErr) stuckQueued = rows.length;
        else console.warn('[wavoip-sync-history] enqueue stuck failed', qErr.message);
      }
    }

    return new Response(JSON.stringify({ ok: true, devices: summary, stuck_queued: stuckQueued }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[wavoip-sync-history] fatal', e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
