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
function toInt(n: number): number {
  return Number.isFinite(n) ? Math.round(n) : 0;
}

const STATUS_CANON: Record<string, string> = {
  CALLING: 'calling', OUTGOING_CALLING: 'calling',
  RINGING: 'ringing', INCOMING_RING: 'ringing', OUTGOING_RING: 'ringing',
  CONNECTING: 'connecting',
  ACTIVE: 'active', ACCEPT: 'active', ACCEPTED: 'active',
  ENDED: 'ended', CANCELLED: 'cancelled', REJECTED: 'rejected',
  NOT_ANSWERED: 'not_answered', FAILED: 'failed',
  HANDLED_REMOTELY: 'handled_remotely', MISSED: 'missed',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({} as any));
    const whatsappCallId = String(body?.whatsapp_call_id ?? '').trim();
    const bodyToken = body?.device_token ? String(body.device_token) : null;
    const bodyClientId = body?.client_id ? String(body.client_id) : null;
    if (!whatsappCallId) {
      return new Response(JSON.stringify({ error: 'whatsapp_call_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Localizar o dispositivo.
    let device: any = null;
    // Carrega log existente para preservar device_id/client_id/app_user_id já gravados.
    const { data: existingLog } = await admin.from('wavoip_call_logs')
      .select('id,device_id,client_id,app_user_id,from_number,to_number,started_at,ended_at,answered_at,duration_seconds,recording_status,recording_url,metadata')
      .eq('whatsapp_call_id', whatsappCallId).maybeSingle();

    if (bodyToken) {
      const { data } = await admin.from('wavoip_devices')
        .select('id,device_token,provider_id,client_id,app_user_id')
        .eq('device_token', bodyToken).maybeSingle();
      device = data ?? null;
    }
    if (!device) {
      if (existingLog?.device_id) {
        const { data } = await admin.from('wavoip_devices')
          .select('id,device_token,provider_id,client_id,app_user_id')
          .eq('id', existingLog.device_id).maybeSingle();
        device = data ?? null;
      }
      // Fallback: qualquer dispositivo com provider_id do mesmo client.
      if (!device?.provider_id) {
        const cid = existingLog?.client_id ?? bodyClientId;
        if (cid) {
          const { data } = await admin.from('wavoip_devices')
            .select('id,device_token,provider_id,client_id,app_user_id')
            .eq('client_id', cid)
            .not('provider_id', 'is', null)
            .limit(1).maybeSingle();
          if (data) device = data;
        }
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
    // Resposta oficial: { type:'success', result:[ { caller, receiver, duration, status,
    //   direction:'OUTCOMING'|'INCOMING', created_date, last_updated_date, record_status, ... } ] }
    const item: any = detailsJson?.result?.[0] ?? detailsJson?.data ?? detailsJson;

    const rawStatus = String(item?.status ?? 'NONE').toUpperCase();
    const canonical = STATUS_CANON[rawStatus] ?? rawStatus.toLowerCase();
    const rawDir = String(item?.direction ?? 'OUTCOMING').toUpperCase();
    const direction = rawDir.startsWith('IN') ? 'inbound' : 'outbound';
    const durationSec = toInt(pickNum(item?.duration, item?.duration_seconds));
    const fromNumber = pickStr(item?.caller, item?.from, item?.from_number);
    const toNumber   = pickStr(item?.receiver, item?.to, item?.to_number);
    const startedAt = item?.created_date
      ? new Date(item.created_date).toISOString()
      : (item?.started_at ?? item?.start_at ?? null);
    const endedAt = item?.last_updated_date
      ? new Date(item.last_updated_date).toISOString()
      : (item?.ended_at ?? item?.end_at ?? null);

    // Preserva o dispositivo/cliente já gravado (evita trocar o device escolhido pelo usuário).
    const preservedDeviceId = existingLog?.device_id ?? device.id;
    const preservedClientId = existingLog?.client_id ?? device.client_id ?? null;
    const preservedAppUserId = existingLog?.app_user_id ?? device.app_user_id ?? null;

    const prevMeta = (existingLog?.metadata as any) ?? {};
    const row: Record<string, any> = {
      whatsapp_call_id: whatsappCallId,
      device_id: preservedDeviceId,
      client_id: preservedClientId,
      app_user_id: preservedAppUserId,
      direction,
      status: canonical,
      // A API oficial da Wavoip é a fonte da verdade: se retornou valor, sobrescreve.
      from_number: fromNumber ?? existingLog?.from_number ?? null,
      to_number:   toNumber   ?? existingLog?.to_number   ?? null,
      // direction vem sempre do payload oficial (`direction` já resolvido acima).
      whatsapp_jid: pickStr(item?.jid, item?.whatsapp_jid) ?? undefined,
      started_at:  startedAt ?? existingLog?.started_at ?? null,
      answered_at: existingLog?.answered_at ?? (durationSec > 0 ? (startedAt ?? null) : null),
      ended_at:    endedAt ?? existingLog?.ended_at ?? null,
      duration_seconds: durationSec > 0 ? durationSec : (existingLog?.duration_seconds ?? 0),
      end_reason:  rawStatus,
      metadata: { ...prevMeta, source: 'fetch-call-details', details: item },
    };
    // Preserva gravação já resolvida.
    if (existingLog?.recording_status) row.recording_status = existingLog.recording_status;
    if (existingLog?.recording_url)    row.recording_url    = existingLog.recording_url;

    const { error: upErr } = await admin.from('wavoip_call_logs')
      .upsert(row, { onConflict: 'whatsapp_call_id' });
    if (upErr) throw upErr;

    // Enfileira reconcile em 1 min para completar duração/gravação quando ainda pendentes.
    try {
      await admin.from('wavoip_reconcile_queue').upsert(
        {
          whatsapp_call_id: whatsappCallId,
          run_after: new Date(Date.now() + 60_000).toISOString(),
          attempts: 0,
          status: 'pending',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'whatsapp_call_id' } as any,
      );
    } catch (e) { console.warn('[fetch-call-details] enqueue reconcile failed', e); }

    return new Response(JSON.stringify({ ok: true, whatsapp_call_id: whatsappCallId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});