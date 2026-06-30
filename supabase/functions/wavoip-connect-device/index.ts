import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const body = await req.json().catch(() => ({}));
    const device_id: string | undefined = body?.device_id;

    if (!device_id) {
      return new Response(JSON.stringify({ ok: false, error: 'device_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: device, error: getErr } = await admin
      .from('wavoip_devices')
      .select('*')
      .eq('id', device_id)
      .single();

    if (getErr || !device) {
      return new Response(JSON.stringify({ ok: false, error: 'device_not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // O token de dispositivo da Wavoip não é Bearer token de REST API.
    // A documentação indica que o vínculo do WhatsApp é feito via QR Code
    // e que o estado real vem do SDK/Webphone (WebSocket): Device.status=open.
    const qr_url = `https://devices.wavoip.com/${encodeURIComponent(device.device_token)}/whatsapp/qr-image`;
    const { data: updated, error: updErr } = await admin
      .from('wavoip_devices')
      .update({
        connection_status: 'connecting',
        connected_at: null,
        last_seen_at: new Date().toISOString(),
        metadata: {
          ...(device.metadata ?? {}),
          qr_url,
          last_connect: {
            type: 'qr_prepared',
            source: 'wavoip-connect-device',
            prepared_at: new Date().toISOString(),
          },
          last_error: null,
        },
      })
      .eq('id', device_id)
      .select('*')
      .single();

    if (updErr) {
      return new Response(JSON.stringify({ ok: false, error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, qr_url, device: updated }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});