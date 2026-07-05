import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Reconcilia uma chamada Wavoip usando o endpoint oficial
// GET https://api.wavoip.com/calls/whatsapp/{whatsapp_call_id}
// Atualiza status/duração/timestamps e agenda download de gravação.

const WAVOIP_API = 'https://api.wavoip.com';
const MAX_ATTEMPTS = 5;

const STATUS_CANON: Record<string, string> = {
  CALLING: 'calling', OUTGOING_CALLING: 'calling',
  RINGING: 'ringing', INCOMING_RING: 'ringing', OUTGOING_RING: 'ringing',
  CONNECTING: 'connecting',
  ACTIVE: 'active', ACCEPT: 'active', ACCEPTED: 'active',
  ENDED: 'ended', CANCELLED: 'cancelled', REJECTED: 'rejected',
  NOT_ANSWERED: 'not_answered', FAILED: 'failed',
  HANDLED_REMOTELY: 'handled_remotely', MISSED: 'missed',
};

async function fetchRecording(supabaseUrl: string, serviceKey: string, whatsapp_call_id: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/wavoip-fetch-recording`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey },
      body: JSON.stringify({ whatsapp_call_id }),
    });
  } catch (e) { console.warn('[reconcile] trigger rec failed', e); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({} as any));
    const wid = body?.whatsapp_call_id ? String(body.whatsapp_call_id) : null;
    const logId = body?.call_log_id ? String(body.call_log_id) : null;
    if (!wid && !logId) {
      return new Response(JSON.stringify({ error: 'missing whatsapp_call_id or call_log_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Carrega log e device (device_token para autenticar na Wavoip).
    const sel = admin.from('wavoip_call_logs').select('id,whatsapp_call_id,device_id,metadata,started_at,answered_at,ended_at,duration_seconds,from_number,to_number,recording_status,recording_url').limit(1);
    const { data: rows, error: selErr } = wid ? await sel.eq('whatsapp_call_id', wid) : await sel.eq('id', logId!);
    if (selErr) throw selErr;
    const log = rows?.[0];
    if (!log) {
      return new Response(JSON.stringify({ ok: false, status: 'log_not_found' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callId = log.whatsapp_call_id;
    if (!callId) {
      return new Response(JSON.stringify({ error: 'no_whatsapp_call_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // device_token
    let deviceToken: string | null = null;
    if (log.device_id) {
      const { data: dev } = await admin.from('wavoip_devices').select('device_token').eq('id', log.device_id).maybeSingle();
      deviceToken = (dev as any)?.device_token ?? null;
    }
    if (!deviceToken) {
      return new Response(JSON.stringify({ ok: false, error: 'no_device_token' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch(`${WAVOIP_API}/calls/whatsapp/${encodeURIComponent(callId)}`, {
      headers: { 'Authorization': `Bearer ${deviceToken}` },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return new Response(JSON.stringify({ ok: false, error: `wavoip_http_${res.status}`, body: txt.slice(0, 300) }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const json = await res.json().catch(() => null) as any;
    const item = json?.result?.[0];
    if (!item) {
      return new Response(JSON.stringify({ ok: false, error: 'empty_result' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawStatus = String(item.status ?? 'NONE').toUpperCase();
    const canonical = STATUS_CANON[rawStatus] ?? rawStatus.toLowerCase();
    const durationSec = Math.round(Number(item.duration ?? 0) || 0);
    const rawDir = String(item.direction ?? 'OUTCOMING').toUpperCase();
    const direction = rawDir.startsWith('IN') ? 'inbound' : 'outbound';
    const recStatus = String(item.record_status ?? '').toUpperCase();

    const meta = (log.metadata as any) ?? {};
    meta.reconciled_at = new Date().toISOString();
    meta.reconciled_payload = item;
    const attempts = Number(meta.reconcile_attempts ?? 0) + 1;
    meta.reconcile_attempts = attempts;

    // Decide recording_status novo
    let newRecStatus = log.recording_status;
    if (durationSec > 0) {
      if (recStatus === 'READY') newRecStatus = log.recording_status === 'available' ? 'available' : 'pending';
      else newRecStatus = 'pending';
    } else {
      newRecStatus = 'none';
    }

    const patch: any = {
      status: canonical,
      end_reason: rawStatus,
      direction,
      duration_seconds: durationSec,
      from_number: item.caller ?? log.from_number,
      to_number: item.receiver ?? log.to_number,
      started_at: log.started_at ?? (item.created_date ? new Date(item.created_date).toISOString() : null),
      ended_at: log.ended_at ?? (item.last_updated_date ? new Date(item.last_updated_date).toISOString() : null),
      answered_at: log.answered_at ?? (durationSec > 0 && item.created_date ? new Date(item.created_date).toISOString() : null),
      recording_status: newRecStatus,
      metadata: meta,
    };
    await admin.from('wavoip_call_logs').update(patch).eq('id', log.id);

    // Baixa gravação se pronta.
    let scheduledRetry = false;
    if (durationSec > 0 && recStatus === 'READY') {
      // @ts-ignore
      const wait = (globalThis as any)?.EdgeRuntime?.waitUntil ?? ((p: Promise<unknown>) => p);
      wait(fetchRecording(supabaseUrl, serviceKey, callId));
    } else if (durationSec > 0 && attempts < MAX_ATTEMPTS) {
      // reenfileira em 1 min
      const runAfter = new Date(Date.now() + 60_000).toISOString();
      await admin.from('wavoip_reconcile_queue').upsert(
        { whatsapp_call_id: callId, run_after: runAfter, attempts, status: 'pending', updated_at: new Date().toISOString() },
        { onConflict: 'whatsapp_call_id' } as any,
      ).select();
      scheduledRetry = true;
    }

    return new Response(JSON.stringify({ ok: true, status: canonical, duration: durationSec, recording: newRecStatus, attempts, scheduledRetry }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});