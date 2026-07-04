import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Consolida os dados oficiais de uma chamada Wavoip em `wavoip_call_logs`.
// Body: { whatsapp_call_id: string, device_token?: string }
//
// Fluxo:
// 1. Localiza o dispositivo (via device_token OU via wavoip_call_logs.device_id).
// 2. Obtém o provider_id do dispositivo e busca o JWT via wavoip-providers get_token.
// 3. Chama GET {api_base}/calls/whatsapp/{whatsapp_call_id}.
// 4. Faz upsert em wavoip_call_logs (onConflict whatsapp_call_id) preservando
//    campos de gravação (recording_status / recording_url).

function pickStr(...vals: any[]): string | null {
  for (const v of vals) if (v != null && String(v).length > 0) return String(v);
  return null;
}
function pickNum(...vals: any[]): number {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({} as any));
    const whatsappCallId = String(body?.whatsapp_call_id ?? '').trim();
    const bodyToken = body?.device_token ? String(body.device_token) : null;
    if (!whatsappCallId) {
      return new Response(JSON.stringify({ error: 'whatsapp_call_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Localizar o dispositivo.
    let device: any = null;
    if (bodyToken) {
      const { data } = await admin.from('wavoip_devices')
        .select('id,device_token,provider_id,client_id,app_user_id')
        .eq('device_token', bodyToken).maybeSingle();
      device = data ?? null;
    }
    if (!device) {
      const { data: log } = await admin.from('wavoip_call_logs')
        .select('device_id,client_id,app_user_id')
        .eq('whatsapp_call_id', whatsappCallId).maybeSingle();
      if (log?.device_id) {
        const { data } = await admin.from('wavoip_devices')
          .select('id,device_token,provider_id,client_id,app_user_id')
          .eq('id', log.device_id).maybeSingle();
        device = data ?? null;
      }
    }
    if (!device?.provider_id) {
      return new Response(JSON.stringify({ error: 'Dispositivo/provedor não localizado para essa chamada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Buscar JWT + api_base via wavoip-providers.
    const provRes = await fetch(`${supabaseUrl}/functions/v1/wavoip-providers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      body: JSON.stringify({ action: 'get_token', data: { id: device.provider_id } }),
    });
    const provJson = await provRes.json().catch(() => ({} as any));
    const apiBase: string = provJson?.data?.api_base || 'https://api.wavoip.com';
    const jwt: string | null = provJson?.data?.token ?? null;
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Token do provedor Wavoip indisponível' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3) GET /calls/whatsapp/:id
    const detailsRes = await fetch(`${apiBase.replace(/\/$/, '')}/calls/whatsapp/${encodeURIComponent(whatsappCallId)}`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    const detailsJson: any = await detailsRes.json().catch(() => null);
    if (!detailsRes.ok || !detailsJson) {
      return new Response(JSON.stringify({ error: 'Falha ao consultar detalhes da chamada', status: detailsRes.status, body: detailsJson }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const payload = detailsJson?.data ?? detailsJson;

    // 4) Upsert idempotente (preserva recording_status/recording_url).
    const rawDir = String(payload?.direction ?? '').toLowerCase();
    const direction = rawDir.includes('in') ? 'inbound' : 'outbound';
    const peer = payload?.peer ?? {};
    const row: Record<string, any> = {
      whatsapp_call_id: whatsappCallId,
      device_id: device.id,
      client_id: device.client_id,
      app_user_id: device.app_user_id,
      direction,
      status: String(payload?.status ?? 'ended').toLowerCase(),
      from_number: pickStr(payload?.from, payload?.from_number, direction === 'inbound' ? (peer?.number ?? peer?.phone) : null),
      to_number:   pickStr(payload?.to,   payload?.to_number,   direction === 'outbound' ? (peer?.number ?? peer?.phone) : null),
      whatsapp_jid: pickStr(payload?.jid, payload?.whatsapp_jid),
      started_at:  payload?.started_at ?? payload?.start_at ?? null,
      answered_at: payload?.answered_at ?? null,
      ended_at:    payload?.ended_at ?? payload?.end_at ?? null,
      duration_seconds: pickNum(payload?.duration, payload?.duration_seconds),
      end_reason:  pickStr(payload?.end_reason, payload?.reason),
      metadata: { source: 'fetch-call-details', details: payload },
    };
    const { error: upErr } = await admin.from('wavoip_call_logs')
      .upsert(row, { onConflict: 'whatsapp_call_id' });
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ ok: true, whatsapp_call_id: whatsappCallId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});