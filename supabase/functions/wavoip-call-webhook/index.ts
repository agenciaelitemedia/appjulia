import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Public webhook to receive call events from Wavoip and persist them in wavoip_call_logs.
// Payload reference (CALL event): { type, action, whatsapp_call_id, caller, receiver, status,
//   direction: 'INCOMING'|'OUTCOMING', duration, ... , device_token? }

const TERMINAL_STATUSES = new Set([
  'ENDED', 'ended',
  'REJECTED', 'rejected',
  'NOT_ANSWERED', 'not_answered',
  'FAILED', 'failed',
  'HANDLED_REMOTELY', 'handled_remotely',
]);

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
  } catch (e) {
    console.warn('[wavoip-call-webhook] failed to trigger fetch-recording', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const payload = await req.json().catch(() => ({} as any));
    const token: string | undefined = payload?.device_token ?? payload?.token ?? payload?.device?.token;
    const rawDirection = String(payload?.direction ?? payload?.call?.direction ?? 'outbound').toLowerCase();
    const direction = (rawDirection === 'inbound' || rawDirection === 'incoming' || rawDirection === 'incomming') ? 'inbound' : 'outbound';
    const rawStatus = String(payload?.status ?? payload?.call?.status ?? 'unknown');
    const status = rawStatus.toLowerCase();
    const fromNumber = payload?.from ?? payload?.caller ?? payload?.call?.from ?? null;
    const toNumber = payload?.to ?? payload?.receiver ?? payload?.call?.to ?? null;
    const jid = payload?.jid ?? payload?.call?.jid ?? null;
    const started_at = payload?.started_at ?? payload?.call?.started_at ?? null;
    const answered_at = payload?.answered_at ?? payload?.call?.answered_at ?? null;
    const ended_at = payload?.ended_at ?? payload?.call?.ended_at ?? null;
    const duration = Number(payload?.duration ?? payload?.call?.duration ?? 0) || 0;
    const end_reason = payload?.end_reason ?? payload?.call?.end_reason ?? null;
    const whatsapp_call_id = payload?.whatsapp_call_id != null
      ? String(payload.whatsapp_call_id)
      : (payload?.call?.whatsapp_call_id != null ? String(payload.call.whatsapp_call_id) : null);

    let device_id: string | null = null;
    let user_id: string | null = null;
    let app_user_id: number | null = null;
    let client_id: number | null = null;
    if (token) {
      const { data: dev } = await admin.from('wavoip_devices').select('id,user_id,app_user_id,client_id').eq('device_token', token).maybeSingle();
      if (dev) {
        device_id = dev.id;
        user_id = dev.user_id;
        app_user_id = (dev as any).app_user_id ?? null;
        client_id = (dev as any).client_id ?? null;
        await admin.from('wavoip_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', dev.id);
      }
    }

    // Upsert por whatsapp_call_id quando disponível (action=UPDATE atualiza a mesma linha).
    let logId: string | null = null;
    if (whatsapp_call_id) {
      const { data: existing } = await admin
        .from('wavoip_call_logs')
        .select('id')
        .eq('whatsapp_call_id', whatsapp_call_id)
        .maybeSingle();
      if (existing?.id) {
        const { error: upErr } = await admin.from('wavoip_call_logs').update({
          status, direction,
          from_number: fromNumber, to_number: toNumber, whatsapp_jid: jid,
          started_at, answered_at, ended_at,
          duration_seconds: duration, end_reason,
          metadata: payload ?? {},
          ...(device_id ? { device_id } : {}),
          ...(app_user_id != null ? { app_user_id } : {}),
          ...(client_id != null ? { client_id } : {}),
        }).eq('id', existing.id);
        if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        logId = existing.id;
      }
    }
    if (!logId) {
      const { data: inserted, error } = await admin.from('wavoip_call_logs').insert({
        user_id, app_user_id, client_id, device_id,
        direction, status,
        from_number: fromNumber, to_number: toNumber, whatsapp_jid: jid,
        started_at, answered_at, ended_at,
        duration_seconds: duration, end_reason,
        whatsapp_call_id,
        recording_status: whatsapp_call_id ? 'pending' : 'unavailable',
        metadata: payload ?? {},
      }).select('id').single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      logId = inserted?.id ?? null;
    }

    // Dispara busca da gravação em background para eventos terminais com whatsapp_call_id.
    if (whatsapp_call_id && (TERMINAL_STATUSES.has(rawStatus) || TERMINAL_STATUSES.has(status))) {
      // @ts-ignore EdgeRuntime available in Deno deploy
      const wait = (globalThis as any)?.EdgeRuntime?.waitUntil ?? ((p: Promise<unknown>) => p);
      wait(triggerFetchRecording(supabaseUrl, serviceKey, whatsapp_call_id));
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});