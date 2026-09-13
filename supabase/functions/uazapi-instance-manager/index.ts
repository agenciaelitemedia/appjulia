// ============================================
// UaZapi Instance Manager
// Server-side lifecycle management for UaZapi instances
// Uses UAZAPI_ADMIN_TOKEN and UAZAPI_BASE_URL from secrets
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Eventos padrão do webhook UaZapi — nomes canônicos conforme
// https://docs.uazapi.com/endpoint/post/webhook
// (a doc lista nomes sem dot-notation; os antigos chats.update / contacts.update
// etc. eram ignorados silenciosamente pelo servidor)
const DEFAULT_WEBHOOK_EVENTS = [
  'connection',       // estado da conexão
  'messages',         // mensagens recebidas/enviadas (inclui fromMe via API)
  'messages_update',  // edição/status/delete
  'history',          // backfill on-demand
  'chats',            // eventos de conversas
  'contacts',         // atualizações de contato + foto de perfil
  'groups',           // mudanças em grupo, inclusive foto
  'presence',         // presença
  'call',             // chamadas VoIP
];

async function configureWebhook(baseUrl: string, instanceToken: string, supabaseUrl: string, queueId: string) {
  const webhookEndpoint = `${supabaseUrl}/functions/v1/uazapi-chat-webhook?queue_id=${queueId}`;
  const res = await fetch(`${baseUrl}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'token': instanceToken },
    body: JSON.stringify({
      url: webhookEndpoint,
      enabled: true,
      events: DEFAULT_WEBHOOK_EVENTS,
    }),
  });
  const text = await res.text();
  console.log(`[uazapi-instance-manager] Webhook set (${res.status}): ${webhookEndpoint}`);
  return { ok: res.ok, status: res.status, body: text, url: webhookEndpoint };
}

// Lê a config atual de webhook da instância (GET /webhook) e normaliza,
// tolerando os formatos {..}, [{..}] e {webhooks:[{..}]}
async function readWebhook(baseUrl: string, instanceToken: string) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/webhook`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'token': instanceToken },
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { /* noop */ }

  let entry: any = parsed;
  if (Array.isArray(parsed)) entry = parsed[0] ?? null;
  else if (parsed && Array.isArray(parsed.webhooks)) entry = parsed.webhooks[0] ?? null;

  const events: string[] = Array.isArray(entry?.events)
    ? entry.events.map((e: unknown) => String(e))
    : (typeof entry?.events === 'string' ? entry.events.split(',').map((e: string) => e.trim()).filter(Boolean) : []);

  return {
    http_status: res.status,
    ok: res.ok,
    raw: res.ok ? undefined : text.slice(0, 300),
    url: typeof entry?.url === 'string' ? entry.url : null,
    enabled: entry?.enabled === undefined ? null : Boolean(entry.enabled),
    events,
  };
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getQueueCredentials(queueId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('queues')
    .select('evo_url, evo_apikey, evo_instance, name')
    .eq('id', queueId)
    .single();
  if (error || !data) throw new Error('Queue not found');
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, queue_id, instance_name } = await req.json();
    const baseUrl = Deno.env.get('UAZAPI_BASE_URL');
    const adminToken = Deno.env.get('UAZAPI_ADMIN_TOKEN');

    if (!baseUrl || !adminToken) {
      return respond({ error: 'UAZAPI_BASE_URL or UAZAPI_ADMIN_TOKEN not configured' }, 500);
    }

    switch (action) {
      // ==========================================
      // CREATE instance on UaZapi server
      // Uses /instance/init with admintoken header
      // ==========================================
      case 'create': {
        if (!instance_name) return respond({ error: 'instance_name required' }, 400);

        console.log(`[uazapi-instance-manager] Creating instance: ${instance_name}`);
        const res = await fetch(`${baseUrl}/instance/init`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'admintoken': adminToken,
          },
          body: JSON.stringify({ name: instance_name }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error('[uazapi-instance-manager] Create failed:', errorText);
          return respond({ error: 'Failed to create instance', details: errorText }, 500);
        }

        const instanceData = await res.json();
        const instanceToken = instanceData.token;
        const finalName = instanceData.name || instance_name;

        console.log(`[uazapi-instance-manager] Instance created: ${finalName}, token: ${instanceToken ? 'yes' : 'no'}`);

        // Configure webhook with full event set for modern chat
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const webhookQueueId = queue_id;
        if (supabaseUrl && instanceToken) {
          try {
            await configureWebhook(baseUrl, instanceToken, supabaseUrl, webhookQueueId || '');
          } catch (e) {
            console.warn('[uazapi-instance-manager] Webhook config failed:', e);
          }
        }

        return respond({
          success: true,
          instance_token: instanceToken,
          instance_name: finalName,
        });
      }

      // ==========================================
      // RECONFIGURE WEBHOOK on existing instance
      // ==========================================
      case 'reconfigure_webhook': {
        if (!queue_id) return respond({ error: 'queue_id required' }, 400);
        const queue = await getQueueCredentials(queue_id);
        const token = queue.evo_apikey;
        const url = queue.evo_url || baseUrl;
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        if (!token || !supabaseUrl) {
          return respond({ error: 'Queue without instance token or SUPABASE_URL' }, 400);
        }
        const result = await configureWebhook(url, token, supabaseUrl, queue_id);
        return respond({ success: result.ok, ...result, events: DEFAULT_WEBHOOK_EVENTS });
      }

      // ==========================================
      // RECONFIGURE WEBHOOK on ALL active UaZapi queues
      // (maintenance: re-subscribes messages.update etc.)
      // ==========================================
      case 'reconfigure_webhook_all': {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        if (!supabaseUrl) return respond({ error: 'SUPABASE_URL missing' }, 500);
        const supabase = getSupabase();
        const { data: queues, error } = await supabase
          .from('queues')
          .select('id, name, evo_url, evo_apikey')
          .eq('channel_type', 'uazapi')
          .eq('is_active', true);
        if (error) return respond({ error: error.message }, 500);
        const results: Array<Record<string, unknown>> = [];
        for (const q of (queues ?? [])) {
          if (!q.evo_apikey) {
            results.push({ queue_id: q.id, name: q.name, ok: false, reason: 'no_token' });
            continue;
          }
          try {
            const r = await configureWebhook(q.evo_url || baseUrl, q.evo_apikey, supabaseUrl, q.id);
            results.push({ queue_id: q.id, name: q.name, ok: r.ok, status: r.status });
          } catch (e) {
            results.push({ queue_id: q.id, name: q.name, ok: false, error: (e as Error).message });
          }
        }
        const okCount = results.filter((r) => r.ok).length;
        return respond({ success: true, total: results.length, ok: okCount, results });
      }

      // ==========================================
      // AUDIT WEBHOOKS - lê a config de webhook de todas as filas UaZapi
      // ativas (não excluídas) e compara com o esperado
      // ==========================================
      case 'audit_webhooks': {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        if (!supabaseUrl) return respond({ error: 'SUPABASE_URL missing' }, 500);
        const supabase = getSupabase();
        let query = supabase
          .from('queues')
          .select('id, name, client_id, evo_url, evo_apikey, evo_instance, is_active')
          .eq('channel_type', 'uazapi')
          .or('is_deleted.is.null,is_deleted.eq.false');
        if (queue_id) query = query.eq('id', queue_id);
        const { data: queues, error } = await query;
        if (error) return respond({ error: error.message }, 500);

        const list = (queues ?? []).filter((q) => q.is_active !== false);

        const auditOne = async (q: any) => {
          const expectedUrl = `${supabaseUrl}/functions/v1/uazapi-chat-webhook?queue_id=${q.id}`;
          const base = { queue_id: q.id, name: q.name, client_id: q.client_id, instance: q.evo_instance, expected_url: expectedUrl };
          if (!q.evo_apikey || !q.evo_url) {
            return { ...base, status: 'sem_credenciais', needs_fix: true, missing_events: DEFAULT_WEBHOOK_EVENTS };
          }
          try {
            const wh = await readWebhook(q.evo_url, q.evo_apikey);
            if (!wh.ok) {
              return { ...base, status: 'erro_provedor', http_status: wh.http_status, error: wh.raw, needs_fix: true };
            }
            const urlOk = (wh.url || '') === expectedUrl;
            const missing = DEFAULT_WEBHOOK_EVENTS.filter((e) => !wh.events.includes(e));
            const needsFix = !urlOk || wh.enabled === false || missing.length > 0;
            return {
              ...base,
              status: needsFix ? 'precisa_corrigir' : 'ok',
              current_url: wh.url,
              url_ok: urlOk,
              enabled: wh.enabled,
              events: wh.events,
              missing_events: missing,
              needs_fix: needsFix,
            };
          } catch (e) {
            return { ...base, status: 'erro_provedor', error: (e as Error).message, needs_fix: true };
          }
        };

        // concorrência limitada para não estourar o tempo da função
        const results: Array<Record<string, unknown>> = [];
        const CONCURRENCY = 6;
        for (let i = 0; i < list.length; i += CONCURRENCY) {
          const slice = list.slice(i, i + CONCURRENCY);
          const settled = await Promise.all(slice.map(auditOne));
          results.push(...settled);
        }

        const needFix = results.filter((r) => r.needs_fix).length;
        return respond({
          success: true,
          expected_events: DEFAULT_WEBHOOK_EVENTS,
          total: results.length,
          ok: results.length - needFix,
          needs_fix: needFix,
          results,
        });
      }

      // ==========================================
      // CONNECT - trigger QR Code generation
      // ==========================================
      case 'connect': {
        if (!queue_id) return respond({ error: 'queue_id required' }, 400);
        const queue = await getQueueCredentials(queue_id);
        const token = queue.evo_apikey || adminToken;
        const url = queue.evo_url || baseUrl;

        console.log(`[uazapi-instance-manager] Connect: ${url}/instance/connect`);
        const res = await fetch(`${url}/instance/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': token },
        });

        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { response: text }; }
        console.log(`[uazapi-instance-manager] Connect response: ${res.status}`);

        return respond({ success: res.ok, data });
      }

      // ==========================================
      // STATUS - check connection & get QR
      // ==========================================
      case 'status': {
        if (!queue_id) return respond({ error: 'queue_id required' }, 400);
        const queue = await getQueueCredentials(queue_id);
        const token = queue.evo_apikey || adminToken;
        const url = queue.evo_url || baseUrl;

        console.log(`[uazapi-instance-manager] Status: ${url}/instance/status`);
        let res = await fetch(`${url}/instance/status`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'token': token },
        });

        // If 401, retry with admin token
        if (res.status === 401 && token !== adminToken) {
          console.log('[uazapi-instance-manager] Retrying status with admintoken...');
          res = await fetch(`${url}/instance/status`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'admintoken': adminToken },
          });
        }

        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { response: text }; }
        console.log(`[uazapi-instance-manager] Status response: ${res.status}`);

        return respond({ success: res.ok, data });
      }

      // ==========================================
      // DISCONNECT - logout instance
      // ==========================================
      case 'disconnect': {
        if (!queue_id) return respond({ error: 'queue_id required' }, 400);
        const queue = await getQueueCredentials(queue_id);
        const token = queue.evo_apikey || adminToken;
        const url = queue.evo_url || baseUrl;

        console.log(`[uazapi-instance-manager] Logout (unpair): ${queue.evo_instance}`);
        let res = await fetch(`${url}/instance/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': token },
        });

        if (res.status === 401 && token !== adminToken) {
          res = await fetch(`${url}/instance/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'admintoken': adminToken },
          });
        }

        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { response: text }; }
        console.log(`[uazapi-instance-manager] Logout response: ${res.status}`);

        return respond({ success: res.ok, status: res.status, data });
      }

      // ==========================================
      // DELETE - permanently delete instance from UaZapi server
      // ==========================================
      case 'delete': {
        if (!queue_id) return respond({ error: 'queue_id required' }, 400);
        const queue = await getQueueCredentials(queue_id);
        const token = queue.evo_apikey || adminToken;
        const url = queue.evo_url || baseUrl;
        const instanceName = queue.evo_instance;

        console.log(`[uazapi-instance-manager] Delete instance: ${instanceName} @ ${url}`);
        let res = await fetch(`${url}/instance`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'token': token },
        });

        if (res.status === 401 && token !== adminToken) {
          console.log('[uazapi-instance-manager] Retrying delete with admintoken...');
          res = await fetch(`${url}/instance`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'admintoken': adminToken },
          });
        }

        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { response: text }; }

        // Treat 404/410 as success (instance already gone)
        const ok = res.ok || res.status === 404 || res.status === 410;
        console.log(`[uazapi-instance-manager] Delete response: ${res.status} (ok=${ok})`);

        return respond({ success: ok, status: res.status, data });
      }

      default:
        return respond({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error('[uazapi-instance-manager] Error:', error);
    return respond({ error: (error as Error).message }, 500);
  }
});
