// ============================================
// Chat Reset
// Cleans all chat tables for a specific client_id
// or all clients. Optionally also clears
// whatsapp sync tables.
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// Tables that have a `client_id` column directly
const CHAT_TABLES_WITH_CLIENT_ID = [
  'chat_ai_autoreply_logs',
  'chat_ai_classifications',
  'chat_automation_logs',
  'chat_csat_responses',
  'chat_messages',
  'chat_conversations',
  'chat_contacts',
];

// Child tables filtered via conversation_id
const CHILD_TABLES_BY_CONVERSATION = [
  'chat_message_reactions', // via message_id -> chat_messages
  'chat_mentions',
  'chat_conversation_history',
  'chat_conversation_tags',
  'chat_conversation_participants',
  'chat_conversation_presence',
  'chat_conversation_summaries',
];

const SYNC_TABLES = ['whatsapp_sync_job_logs', 'whatsapp_sync_jobs'];

// Tables populated by inbound webhooks (UaZapi, Meta) — sempre limpas no reset.
// Logs/queue globais (sem client_id) só são limpos no escopo "todos".
const WEBHOOK_TABLES_GLOBAL = ['webhook_logs', 'webhook_queue'];
const WEBHOOK_TABLES_BY_CLIENT = ['uazapi_history_items', 'uazapi_history_runs', 'chat_webhook_deliveries', 'chat_webhooks'];

// Order matters: children first, then parents
const TRUNCATE_ALL_ORDER = [
  'chat_message_reactions',
  'chat_mentions',
  'chat_ai_classifications',
  'chat_ai_autoreply_logs',
  'chat_automation_logs',
  'chat_csat_responses',
  'chat_conversation_history',
  'chat_conversation_tags',
  'chat_conversation_participants',
  'chat_conversation_presence',
  'chat_conversation_summaries',
  'chat_messages',
  'chat_conversations',
  'chat_contacts',
  // Webhook tables (children first)
  'uazapi_history_items',
  'uazapi_history_runs',
  'chat_webhook_deliveries',
  'chat_webhooks',
  'webhook_logs',
  'webhook_queue',
];

async function deleteAndCount(supabase: ReturnType<typeof getSupabase>, table: string, filter: (q: any) => any): Promise<number> {
  try {
    const q = filter(supabase.from(table).delete({ count: 'exact' }));
    const { count, error } = await q;
    if (error) {
      console.warn(`[chat-reset] delete ${table} failed:`, error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.warn(`[chat-reset] delete ${table} threw:`, (err as Error).message);
    return 0;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;
    const supabase = getSupabase();

    if (action === 'list_clients') {
      const { data, error } = await supabase
        .from('queues')
        .select('client_id')
        .eq('is_deleted', false);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const row of data ?? []) {
        const id = String((row as any).client_id);
        map.set(id, (map.get(id) ?? 0) + 1);
      }
      const clients = Array.from(map.entries())
        .map(([client_id, queues_count]) => ({ client_id, queues_count }))
        .sort((a, b) => a.client_id.localeCompare(b.client_id));
      return new Response(JSON.stringify({ success: true, clients }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reset') {
      const clientId: string | null = body?.client_id && body.client_id !== 'all' ? String(body.client_id) : null;
      const includeSync: boolean = !!body?.include_sync;
      const deleted: Record<string, number> = {};

      if (!clientId) {
        // Reset all — delete from each table without filter (TRUNCATE not available via PostgREST)
        for (const t of TRUNCATE_ALL_ORDER) {
          deleted[t] = await deleteAndCount(supabase, t, (q) => q.not('id', 'is', null));
        }
        if (includeSync) {
          for (const t of SYNC_TABLES) {
            deleted[t] = await deleteAndCount(supabase, t, (q) => q.not('id', 'is', null));
          }
        }
      } else {
        // Get conversation ids for this client first
        const { data: convs } = await supabase
          .from('chat_conversations')
          .select('id')
          .eq('client_id', clientId);
        const convIds = (convs ?? []).map((c: any) => c.id);

        // Get message ids for chat_message_reactions
        let messageIds: string[] = [];
        if (convIds.length > 0) {
          const { data: msgs } = await supabase
            .from('chat_messages')
            .select('id')
            .eq('client_id', clientId);
          messageIds = (msgs ?? []).map((m: any) => m.id);
        }

        // Delete reactions by message_id
        if (messageIds.length > 0) {
          // Chunk to avoid URL length limits
          let total = 0;
          for (let i = 0; i < messageIds.length; i += 200) {
            const slice = messageIds.slice(i, i + 200);
            total += await deleteAndCount(supabase, 'chat_message_reactions', (q) => q.in('message_id', slice));
          }
          deleted['chat_message_reactions'] = total;
        } else {
          deleted['chat_message_reactions'] = 0;
        }

        // Delete child tables by conversation_id
        for (const t of CHILD_TABLES_BY_CONVERSATION) {
          if (t === 'chat_message_reactions') continue;
          if (convIds.length === 0) { deleted[t] = 0; continue; }
          let total = 0;
          for (let i = 0; i < convIds.length; i += 200) {
            const slice = convIds.slice(i, i + 200);
            total += await deleteAndCount(supabase, t, (q) => q.in('conversation_id', slice));
          }
          deleted[t] = total;
        }

        // Delete tables with client_id (in dependency order: children first)
        for (const t of CHAT_TABLES_WITH_CLIENT_ID) {
          deleted[t] = await deleteAndCount(supabase, t, (q) => q.eq('client_id', clientId));
        }

        if (includeSync) {
          for (const t of SYNC_TABLES) {
            // whatsapp_sync_jobs has client_id; logs filter by job_id (best effort delete by client_id if exists, else skip)
            deleted[t] = await deleteAndCount(supabase, t, (q) => q.eq('client_id', clientId));
          }
        }

        // --- Webhook tables (always cleaned, scoped to this client) ---
        // 1) uazapi_history_items via run_id (no client_id column)
        const { data: runs } = await supabase
          .from('uazapi_history_runs')
          .select('id')
          .eq('client_id', clientId);
        const runIds = (runs ?? []).map((r: any) => r.id);
        if (runIds.length > 0) {
          let total = 0;
          for (let i = 0; i < runIds.length; i += 200) {
            const slice = runIds.slice(i, i + 200);
            total += await deleteAndCount(supabase, 'uazapi_history_items', (q) => q.in('run_id', slice));
          }
          deleted['uazapi_history_items'] = total;
        } else {
          deleted['uazapi_history_items'] = 0;
        }
        deleted['uazapi_history_runs'] = await deleteAndCount(supabase, 'uazapi_history_runs', (q) => q.eq('client_id', clientId));

        // 2) chat_webhook_deliveries via webhook_id from chat_webhooks of this client
        const { data: hooks } = await supabase
          .from('chat_webhooks')
          .select('id')
          .eq('client_id', clientId);
        const hookIds = (hooks ?? []).map((h: any) => h.id);
        if (hookIds.length > 0) {
          let total = 0;
          for (let i = 0; i < hookIds.length; i += 200) {
            const slice = hookIds.slice(i, i + 200);
            total += await deleteAndCount(supabase, 'chat_webhook_deliveries', (q) => q.in('webhook_id', slice));
          }
          deleted['chat_webhook_deliveries'] = total;
        } else {
          deleted['chat_webhook_deliveries'] = 0;
        }
        deleted['chat_webhooks'] = await deleteAndCount(supabase, 'chat_webhooks', (q) => q.eq('client_id', clientId));
      }

      return new Response(JSON.stringify({ success: true, deleted, scope: clientId ?? 'all' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[chat-reset] error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});