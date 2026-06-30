import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// A API REST da Wavoip não expõe configuração de webhook (doc oficial: o webhook é
// configurado pelo painel — Dispositivo → Integrações → Webhook). Esta função verifica
// indiretamente: considera webhook OK se o nosso endpoint recebeu algum evento daquele
// device nos últimos N dias (default 7) OU se há call_logs recentes vindos de webhook.
// Persiste: webhook_status ('ok' | 'stale' | 'never'), webhook_url (esperado),
// webhook_checked_at, webhook_last_error.

const STALE_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({} as any));

    let q = admin.from('wavoip_devices').select('id,device_token,client_id,connection_status,webhook_last_received_at,connected_at');
    if (body?.device_token) q = q.eq('device_token', String(body.device_token));
    else if (body?.client_id) q = q.eq('client_id', Number(body.client_id));
    else q = q.eq('connection_status', 'connected');
    const { data: devices, error } = await q;
    if (error) throw error;

    const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
    const nowIso = new Date().toISOString();
    const results: any[] = [];

    for (const d of devices ?? []) {
      const expected = `${supabaseUrl}/functions/v1/wavoip-call-webhook?device_token=${encodeURIComponent(d.device_token)}`;
      let lastReceived: string | null = (d as any).webhook_last_received_at ?? null;

      // Se nunca registramos, tenta inferir pelo último call_log com fonte 'webhook'.
      if (!lastReceived) {
        const { data: lastCall } = await admin
          .from('wavoip_call_logs')
          .select('created_at,metadata')
          .eq('device_id', d.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastCall && (lastCall as any).metadata?.source === 'webhook') {
          lastReceived = (lastCall as any).created_at;
        }
      }

      let status: 'ok' | 'stale' | 'never';
      if (!lastReceived) status = 'never';
      else if (new Date(lastReceived).getTime() < cutoff) status = 'stale';
      else status = 'ok';

      await admin.from('wavoip_devices').update({
        webhook_status: status,
        webhook_url: expected,
        webhook_checked_at: nowIso,
        webhook_last_received_at: lastReceived,
        webhook_last_error: status === 'ok' ? null : (status === 'never'
          ? 'Nenhum evento recebido. Configure o webhook no painel Wavoip → Dispositivo → Integrações → Webhook.'
          : `Sem eventos há mais de ${STALE_DAYS} dias. Reabra o painel Wavoip e confirme a URL.`),
      }).eq('id', d.id);

      results.push({ device_id: d.id, status, expected, lastReceived });
    }

    return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});