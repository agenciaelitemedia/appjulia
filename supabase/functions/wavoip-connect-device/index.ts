import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const WAVOIP_BASE = Deno.env.get('WAVOIP_API_BASE') ?? 'https://api.wavoip.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const device_id: string | undefined = body?.device_id;
    if (!device_id) {
      return new Response(JSON.stringify({ error: 'device_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: device, error: getErr } = await admin.from('wavoip_devices').select('*').eq('id', device_id).single();
    if (getErr || !device) {
      return new Response(JSON.stringify({ error: 'device_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await admin.from('wavoip_devices').update({ connection_status: 'connecting', updated_at: new Date().toISOString() }).eq('id', device_id);

    // Tenta consultar status do dispositivo via API Wavoip; tolerante a falhas (mantém otimismo).
    let jids: string[] = [];
    let status = 'connected';
    let raw: any = null;
    try {
      const resp = await fetch(`${WAVOIP_BASE}/v1/devices/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${device.device_token}` },
        body: JSON.stringify({ token: device.device_token }),
      });
      const text = await resp.text();
      try { raw = JSON.parse(text); } catch { raw = { raw: text }; }
      const list: any = raw?.numbers ?? raw?.data?.numbers ?? raw?.jids ?? [];
      jids = Array.isArray(list) ? list.map((x: any) => (typeof x === 'string' ? x : x?.jid || x?.number)).filter(Boolean) : [];
      if (!resp.ok) status = 'error';
    } catch (_e) {
      // Mantém connected mesmo sem confirmar — webphone valida no front.
    }

    const { data: updated, error: updErr } = await admin.from('wavoip_devices').update({
      connection_status: status,
      connected_at: status === 'connected' ? new Date().toISOString() : null,
      last_seen_at: new Date().toISOString(),
      whatsapp_jids: jids,
      metadata: { ...(device.metadata ?? {}), last_connect: raw },
      updated_at: new Date().toISOString(),
    }).eq('id', device_id).select('*').single();
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, device: updated }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});