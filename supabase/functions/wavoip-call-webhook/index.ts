import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Webhook OFICIAL da Wavoip. Recebe eventos CALL, RECORD e DEVICE.
// Auth: device_token via query string (?device_token=...). Wavoip não assina o body.
// Doc: https://app.wavoip.com (Integrações > Webhook).

const START = new Set(['CALLING', 'RINGING', 'INCOMING_RING', 'OUTGOING_RING', 'OUTGOING_CALLING', 'CONNECTING']);
const ANSWERED = new Set(['ACTIVE', 'ACCEPT', 'ACCEPTED']);
const TERMINAL = new Set(['ENDED', 'CANCELLED', 'REJECTED', 'NOT_ANSWERED', 'FAILED', 'HANDLED_REMOTELY', 'MISSED']);

const STATUS_CANON: Record<string, string> = {
  CALLING: 'calling', OUTGOING_CALLING: 'calling',
  RINGING: 'ringing', INCOMING_RING: 'ringing', OUTGOING_RING: 'ringing',
  CONNECTING: 'connecting',
  ACTIVE: 'active', ACCEPT: 'active', ACCEPTED: 'active',
  ENDED: 'ended', CANCELLED: 'cancelled', REJECTED: 'rejected',
  NOT_ANSWERED: 'not_answered', FAILED: 'failed',
  HANDLED_REMOTELY: 'handled_remotely', MISSED: 'missed',
};

function mapDeviceStatus(s?: string | null): string {
  const v = String(s ?? '').toLowerCase();
  if (v === 'open' || v === 'connected') return 'connected';
  if (v === 'close' || v === 'disconnected') return 'disconnected';
  if (v === 'connecting' || v === 'building' || v === 'restarting') return 'connecting';
  if (v === 'error' || v === 'hibernating') return 'error';
  return v || 'unknown';
}

function pickStr(...vals: any[]): string | null {
  for (const v of vals) if (v != null && String(v).length > 0) return String(v);
  return null;
}

async function triggerFetchRecording(supabaseUrl: string, serviceKey: string, whatsapp_call_id: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/wavoip-fetch-recording`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey },
      body: JSON.stringify({ whatsapp_call_id }),
    });
  } catch (e) { console.warn('[wavoip-call-webhook] trigger rec failed', e); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    const queryToken = url.searchParams.get('device_token');
    const payload = await req.json().catch(() => ({} as any));
    const token: string | null = queryToken ?? payload?.device_token ?? payload?.token ?? null;

    // Resolve dispositivo
    let device_id: string | null = null;
    let user_id: string | null = null;
    let app_user_id: number | null = null;
    let client_id: number | null = null;
    if (token) {
      const { data: dev } = await admin
        .from('wavoip_devices')
        .select('id,user_id,app_user_id,client_id')
        .eq('device_token', token).maybeSingle();
      if (dev) {
        device_id = dev.id;
        user_id = (dev as any).user_id ?? null;
        app_user_id = (dev as any).app_user_id ?? null;
        client_id = (dev as any).client_id ?? null;
        const nowIso = new Date().toISOString();
        await admin.from('wavoip_devices').update({
          last_seen_at: nowIso,
          webhook_last_received_at: nowIso,
          webhook_status: 'ok',
          webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/wavoip-call-webhook?device_token=${encodeURIComponent(token)}`,
          webhook_last_error: null,
        }).eq('id', dev.id);
      }
    }

    const type = String(payload?.type ?? '').toUpperCase();
    const action = String(payload?.action ?? '').toUpperCase();

    // ---------- DEVICE ----------
    if (type === 'DEVICE') {
      if (device_id) {
        const connection_status = mapDeviceStatus(payload?.status);
        await admin.from('wavoip_devices').update({
          connection_status,
          ...(connection_status === 'connected' ? { connected_at: new Date().toISOString() } : {}),
        }).eq('id', device_id);
      }
      return new Response(JSON.stringify({ ok: true, type }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---------- RECORD ----------
    if (type === 'RECORD') {
      const wid = pickStr(payload?.whatsapp_call_id);
      const recStatus = String(payload?.record_status ?? '').toUpperCase();
      if (wid) {
        await admin.from('wavoip_call_logs').update({
          recording_status: recStatus === 'READY' ? 'pending' : recStatus.toLowerCase(),
        }).eq('whatsapp_call_id', wid);
        if (recStatus === 'READY') {
          // @ts-ignore EdgeRuntime
          const wait = (globalThis as any)?.EdgeRuntime?.waitUntil ?? ((p: Promise<unknown>) => p);
          wait(triggerFetchRecording(supabaseUrl, serviceKey, wid));
        }
      }
      return new Response(JSON.stringify({ ok: true, type }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---------- CALL ----------
    if (type === 'CALL') {
      const wid = pickStr(payload?.whatsapp_call_id);
      if (!wid) {
        // Sem ID não há como dedupe — ignora (evita linhas órfãs).
        return new Response(JSON.stringify({ ok: true, skipped: 'no_whatsapp_call_id' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const rawStatus = String(payload?.status ?? 'NONE').toUpperCase();
      const status = STATUS_CANON[rawStatus] ?? rawStatus.toLowerCase();
      const rawDir = String(payload?.direction ?? 'OUTCOMING').toUpperCase();
      const direction = rawDir.startsWith('IN') ? 'inbound' : 'outbound';
      const caller = pickStr(payload?.caller);
      const receiver = pickStr(payload?.receiver);
      const rawDuration = Number(payload?.duration ?? 0) || 0;
      const nowIso = new Date().toISOString();

      // Carrega linha existente p/ preservar timestamps anteriores em UPDATEs parciais.
      const { data: existing } = await admin
        .from('wavoip_call_logs')
        .select('id,started_at,answered_at,ended_at,from_number,to_number,duration_seconds,end_reason,recording_status')
        .eq('whatsapp_call_id', wid).maybeSingle();

      const isStartish = START.has(rawStatus);
      const isAnswered = ANSWERED.has(rawStatus);
      const isTerminal = TERMINAL.has(rawStatus);

      const row: any = {
        whatsapp_call_id: wid,
        device_id, client_id, user_id, app_user_id,
        direction, status,
        from_number: caller ?? existing?.from_number ?? null,
        to_number: receiver ?? existing?.to_number ?? null,
        duration_seconds: rawDuration > 0 ? rawDuration : (existing?.duration_seconds ?? 0),
        started_at: existing?.started_at ?? (isStartish || isAnswered || isTerminal ? nowIso : null),
        answered_at: existing?.answered_at ?? (isAnswered ? nowIso : (isTerminal && rawDuration > 0 ? nowIso : null)),
        ended_at: existing?.ended_at ?? (isTerminal ? nowIso : null),
        end_reason: isTerminal ? rawStatus : (existing?.end_reason ?? null),
        metadata: { source: 'webhook', last_event: action, payload },
      };
      if (isTerminal && existing?.recording_status !== 'available') {
        row.recording_status = 'pending';
      }

      const { error: upErr } = await admin
        .from('wavoip_call_logs')
        .upsert(row, { onConflict: 'whatsapp_call_id' });
      if (upErr) {
        return new Response(JSON.stringify({ error: upErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (isTerminal) {
        // @ts-ignore EdgeRuntime
        const wait = (globalThis as any)?.EdgeRuntime?.waitUntil ?? ((p: Promise<unknown>) => p);
        wait(triggerFetchRecording(supabaseUrl, serviceKey, wid));
      }

      return new Response(JSON.stringify({ ok: true, type, wid }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, ignored_type: type }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
