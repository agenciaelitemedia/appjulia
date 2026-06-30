import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const WAVOIP_BASE = Deno.env.get('WAVOIP_API_BASE') ?? 'https://api.wavoip.com';
const WAVOIP_KEY = Deno.env.get('WAVOIP_API_KEY') ?? '';

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
    const userId = userRes.user.id;
    const body = await req.json().catch(() => ({}));
    const { device_name, whatsapp_number, user_plan_id } = body ?? {};

    if (!WAVOIP_KEY) {
      return new Response(JSON.stringify({ error: 'WAVOIP_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Call Wavoip API to create a device/token. Endpoint kept generic and configurable.
    const resp = await fetch(`${WAVOIP_BASE}/v1/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WAVOIP_KEY}` },
      body: JSON.stringify({ name: device_name || 'Lovable Device', phone: whatsapp_number || null }),
    });
    const raw = await resp.text();
    let data: any = {};
    try { data = JSON.parse(raw); } catch { data = { raw }; }
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'wavoip_api_failed', status: resp.status, data }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token: string | undefined = data?.token ?? data?.device_token ?? data?.data?.token;
    if (!token) {
      return new Response(JSON.stringify({ error: 'no_token_in_response', data }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: inserted, error: insErr } = await admin.from('wavoip_devices').insert({
      user_id: userId,
      user_plan_id: user_plan_id ?? null,
      device_token: token,
      device_name: device_name ?? null,
      whatsapp_number: whatsapp_number ?? null,
      status: 'active',
      provisioned_at: new Date().toISOString(),
      metadata: { provisioned_by: 'wavoip-provision-device', raw: data },
    }).select('*').single();
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, device: inserted }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});