import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Configura automaticamente o Webhook oficial da Wavoip apontando para
// /functions/v1/wavoip-call-webhook?device_token=<token>, com eventos CALL,RECORD,DEVICE.
// Body: { device_token?: string; client_id?: number } — sem device_token, aplica em todos
// os dispositivos do cliente (ou conectados, se nenhum critério).

const WAVOIP_API = 'https://api.wavoip.com';

async function configureOne(token: string, callbackUrl: string): Promise<{ ok: boolean; endpoint?: string; error?: string }> {
  const body = { url: callbackUrl, events: ['CALL', 'RECORD', 'DEVICE'], enabled: true };
  const tries: Array<{ method: string; url: string }> = [
    { method: 'PUT',  url: `${WAVOIP_API}/devices/webhook` },
    { method: 'POST', url: `${WAVOIP_API}/devices/webhook` },
    { method: 'PUT',  url: `${WAVOIP_API}/v1/devices/webhook` },
    { method: 'POST', url: `${WAVOIP_API}/v1/devices/webhook` },
    { method: 'PUT',  url: `${WAVOIP_API}/webhook` },
    { method: 'POST', url: `${WAVOIP_API}/webhook` },
  ];
  let lastErr = '';
  for (const t of tries) {
    try {
      const res = await fetch(t.url, {
        method: t.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (res.ok) return { ok: true, endpoint: `${t.method} ${t.url}` };
      lastErr = `${res.status} ${await res.text().catch(() => '')}`;
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

    let q = admin.from('wavoip_devices').select('id,device_token,client_id,connection_status');
    if (body?.device_token) q = q.eq('device_token', String(body.device_token));
    else if (body?.client_id) q = q.eq('client_id', Number(body.client_id));
    else q = q.eq('connection_status', 'connected');
    const { data: devices, error } = await q;
    if (error) throw error;

    const out: any[] = [];
    for (const d of devices ?? []) {
      const callback = `${supabaseUrl}/functions/v1/wavoip-call-webhook?device_token=${encodeURIComponent(d.device_token)}`;
      const r = await configureOne(d.device_token, callback);
      out.push({ device_id: d.id, ...r });
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
