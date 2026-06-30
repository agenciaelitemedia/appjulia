import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const WAVOIP_BASE = Deno.env.get('WAVOIP_API_BASE') ?? 'https://api.wavoip.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    let jids: string[] = [];
    let status: 'connected' | 'connecting' | 'error' = 'connecting';
    let raw: any = null;
    let apiError: string | null = null;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    try {
      const resp = await fetch(`${WAVOIP_BASE}/devices/status`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${device.device_token}` },
        signal: ac.signal,
      });
      const text = await resp.text();
      try { raw = JSON.parse(text); } catch { raw = { raw: text }; }
      const list: any = raw?.numbers ?? raw?.data?.numbers ?? raw?.jids ?? [];
      jids = Array.isArray(list) ? list.map((x: any) => (typeof x === 'string' ? x : x?.jid || x?.number)).filter(Boolean) : [];
      if (!resp.ok) { status = 'error'; apiError = `wavoip_status_${resp.status}`; }
      else if (jids.length > 0) status = 'connected';
      else status = 'connecting';
    } catch (e: any) {
      apiError = e?.name === 'AbortError' ? 'wavoip_api_timeout' : 'wavoip_api_unreachable';
      status = 'error';
    } finally {
      clearTimeout(timer);
    }

    const { data: updated, error: updErr } = await admin.from('wavoip_devices').update({
      connection_status: status,
      connected_at: status === 'connected' ? new Date().toISOString() : null,
      last_seen_at: new Date().toISOString(),
      whatsapp_jids: jids,
      metadata: { ...(device.metadata ?? {}), last_connect: raw, last_error: apiError },
      updated_at: new Date().toISOString(),
    }).eq('id', device_id).select('*').single();
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (apiError) {
      return new Response(JSON.stringify({ ok: false, error: apiError, device: updated }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true, device: updated }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});