import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Public webhook to receive call events from Wavoip and persist them in wavoip_call_logs.
// Expected payload (best-effort mapping):
// { event, call_id, device_token, direction, status, from, to, jid, started_at, answered_at, ended_at, duration, end_reason, ... }

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
    const direction = (payload?.direction ?? payload?.call?.direction ?? 'outbound').toLowerCase();
    const status = String(payload?.status ?? payload?.call?.status ?? 'unknown').toLowerCase();
    const fromNumber = payload?.from ?? payload?.call?.from ?? null;
    const toNumber = payload?.to ?? payload?.call?.to ?? null;
    const jid = payload?.jid ?? payload?.call?.jid ?? null;
    const started_at = payload?.started_at ?? payload?.call?.started_at ?? null;
    const answered_at = payload?.answered_at ?? payload?.call?.answered_at ?? null;
    const ended_at = payload?.ended_at ?? payload?.call?.ended_at ?? null;
    const duration = Number(payload?.duration ?? payload?.call?.duration ?? 0) || 0;
    const end_reason = payload?.end_reason ?? payload?.call?.end_reason ?? null;

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

    const { error } = await admin.from('wavoip_call_logs').insert({
      user_id,
      app_user_id,
      client_id,
      device_id,
      direction: direction === 'inbound' || direction === 'incoming' ? 'inbound' : 'outbound',
      status,
      from_number: fromNumber,
      to_number: toNumber,
      whatsapp_jid: jid,
      started_at,
      answered_at,
      ended_at,
      duration_seconds: duration,
      end_reason,
      metadata: payload ?? {},
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});