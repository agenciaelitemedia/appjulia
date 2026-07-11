import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

async function tryFetch(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; body: any; error?: string }> {
  try {
    const res = await fetch(url, init);
    let body: any = null;
    try { body = await res.json(); } catch { try { body = await res.text(); } catch {} }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: String((e as Error)?.message ?? e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const body = await req.json().catch(() => ({}));
    const device_id: string | undefined = body?.device_id;
    if (!device_id) {
      return new Response(JSON.stringify({ ok: false, error: 'device_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: device, error: getErr } = await admin
      .from('wavoip_devices').select('*').eq('id', device_id).single();
    if (getErr || !device) {
      return new Response(JSON.stringify({ ok: false, error: 'device_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token: string = device.device_token;
    const attempts: Array<{ endpoint: string; method: string; status: number; ok: boolean; error?: string }> = [];
    let successEndpoint: string | null = null;

    // Tenta os endpoints públicos do host devices.wavoip.com que gerenciam a sessão WhatsApp do device.
    const candidates: Array<{ url: string; method: 'DELETE' | 'GET' | 'POST' }> = [
      { url: `https://devices.wavoip.com/${encodeURIComponent(token)}/whatsapp/logout`, method: 'POST' },
      { url: `https://devices.wavoip.com/${encodeURIComponent(token)}/whatsapp/logout`, method: 'GET' },
      { url: `https://devices.wavoip.com/${encodeURIComponent(token)}/whatsapp`, method: 'DELETE' },
      { url: `https://devices.wavoip.com/${encodeURIComponent(token)}/whatsapp/disconnect`, method: 'POST' },
    ];
    for (const c of candidates) {
      const r = await tryFetch(c.url, { method: c.method, headers: { 'Content-Type': 'application/json', token } });
      attempts.push({ endpoint: c.url, method: c.method, status: r.status, ok: r.ok, error: r.error });
      if (r.ok) { successEndpoint = `${c.method} ${c.url}`; break; }
    }

    // Best-effort: também tenta pelo painel autenticado com JWT do provider (se houver wavoip_device_id).
    let panelAttempt: any = null;
    if (device.provider_id && device.wavoip_device_id) {
      try {
        const { data: tokRes } = await admin.functions.invoke('wavoip-providers', {
          body: { action: 'get_token', data: { id: device.provider_id } },
        });
        const jwt: string | undefined = tokRes?.data?.token ?? tokRes?.token;
        const apiBase: string = tokRes?.data?.api_base ?? tokRes?.api_base ?? 'https://api.wavoip.com';
        if (jwt) {
          const url = `${apiBase.replace(/\/$/, '')}/devices/${encodeURIComponent(device.wavoip_device_id)}/whatsapp/logout`;
          const r = await tryFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` } });
          panelAttempt = { endpoint: url, status: r.status, ok: r.ok, error: r.error };
          if (r.ok && !successEndpoint) successEndpoint = `POST ${url}`;
        }
      } catch (e) {
        panelAttempt = { error: String((e as Error)?.message ?? e) };
      }
    }

    const { data: updated, error: updErr } = await admin
      .from('wavoip_devices')
      .update({
        connection_status: 'disconnected',
        connected_at: null,
        whatsapp_jid: null,
        whatsapp_jids: [],
        whatsapp_number: null,
        last_seen_at: new Date().toISOString(),
        metadata: {
          ...(device.metadata ?? {}),
          last_disconnect: {
            source: 'wavoip-disconnect-device',
            at: new Date().toISOString(),
            success_endpoint: successEndpoint,
            attempts,
            panel_attempt: panelAttempt,
          },
        },
      })
      .eq('id', device_id)
      .select('*')
      .single();

    if (updErr) {
      return new Response(JSON.stringify({ ok: false, error: updErr.message, attempts, panel_attempt: panelAttempt }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      ok: !!successEndpoint,
      success_endpoint: successEndpoint,
      attempts,
      panel_attempt: panelAttempt,
      device: updated,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});