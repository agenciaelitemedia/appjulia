// ============================================
// Queue Maintenance
// Search queues + per-queue destructive ops:
//   - search_queues
//   - preview          → counts before purge
//   - purge_messages_and_media → deletes ALL chat data + storage files of a queue
// Preserves the queue itself (and queue_agent_links).
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

const STORAGE_BUCKET = 'chat-media';

/** Best-effort extractor: return path inside `chat-media` from any URL. */
function extractStoragePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/${STORAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  let path = url.substring(idx + marker.length);
  const q = path.indexOf('?');
  if (q !== -1) path = path.substring(0, q);
  try { path = decodeURIComponent(path); } catch { /* keep raw */ }
  return path || null;
}

async function deleteByIn(
  supabase: ReturnType<typeof getSupabase>,
  table: string,
  column: string,
  ids: (string | number)[],
): Promise<number> {
  if (!ids.length) return 0;
  let total = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const slice = ids.slice(i, i + 500);
    const { count, error } = await supabase.from(table).delete({ count: 'exact' }).in(column, slice);
    if (error) {
      console.warn(`[queue-maintenance] delete ${table}.${column} IN (...) failed:`, error.message);
      continue;
    }
    total += count ?? 0;
  }
  return total;
}

async function deleteByEq(
  supabase: ReturnType<typeof getSupabase>,
  table: string,
  column: string,
  value: string | number,
): Promise<number> {
  const { count, error } = await supabase.from(table).delete({ count: 'exact' }).eq(column, value);
  if (error) {
    console.warn(`[queue-maintenance] delete ${table}.${column}=${value} failed:`, error.message);
    return 0;
  }
  return count ?? 0;
}

async function fetchAllIds(
  supabase: ReturnType<typeof getSupabase>,
  table: string,
  column: string,
  filter: { col: string; val: string | number },
): Promise<string[]> {
  const ids: string[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .eq(filter.col, filter.val)
      .range(from, from + pageSize - 1);
    if (error) {
      console.warn(`[queue-maintenance] fetch ${table}.${column} failed:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    for (const row of data) {
      const v = (row as Record<string, unknown>)[column];
      if (v != null) ids.push(String(v));
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return ids;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');
    const supabase = getSupabase();

    // ---------- search_queues ----------
    if (action === 'search_queues') {
      const clientId = body?.client_id ? String(body.client_id) : null;
      const name = body?.name ? String(body.name).trim() : '';
      const includeDeleted = !!body?.include_deleted;

      let q = supabase
        .from('queues')
        .select('id, client_id, name, channel_type, is_deleted, is_active, created_at')
        .order('client_id', { ascending: true })
        .order('name', { ascending: true })
        .limit(200);
      if (clientId) q = q.eq('client_id', clientId);
      if (name) q = q.ilike('name', `%${name}%`);
      if (!includeDeleted) q = q.eq('is_deleted', false);

      const { data, error } = await q;
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, queues: data ?? [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---------- preview ----------
    if (action === 'preview') {
      const queueId = String(body?.queue_id ?? '');
      if (!queueId) throw new Error('queue_id is required');

      const { data: queue, error: qErr } = await supabase
        .from('queues')
        .select('id, name, client_id, channel_type, is_deleted')
        .eq('id', queueId)
        .maybeSingle();
      if (qErr) throw qErr;
      if (!queue) throw new Error('Queue not found');

      const { count: convCount } = await supabase
        .from('chat_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('queue_id', queueId);

      // chat_messages has NO queue_id column — must go through conversation_id
      const conversationIdsForPreview = await fetchAllIds(
        supabase, 'chat_conversations', 'id', { col: 'queue_id', val: queueId },
      );
      let msgCount = 0;
      let mediaCount = 0;
      for (let i = 0; i < conversationIdsForPreview.length; i += 500) {
        const slice = conversationIdsForPreview.slice(i, i + 500);
        const { count: c1 } = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', slice);
        msgCount += c1 ?? 0;
        const { count: c2 } = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', slice)
          .not('media_url', 'is', null);
        mediaCount += c2 ?? 0;
      }

      return new Response(JSON.stringify({
        success: true,
        queue,
        counts: {
          conversations: convCount ?? 0,
          messages: msgCount,
          media: mediaCount,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---------- purge_messages_and_media ----------
    // NOTE: name kept for backward compatibility. This purge now removes ONLY
    // chat data (messages, conversations and their dependents) of the chosen
    // queue. It does NOT delete contacts and does NOT remove media files
    // from storage — only the DB rows that reference them.
    if (action === 'purge_messages_and_media' || action === 'purge_chat_data') {
      const queueId = String(body?.queue_id ?? '');
      const confirmName = String(body?.confirm_name ?? '');
      if (!queueId) throw new Error('queue_id is required');

      const { data: queue, error: qErr } = await supabase
        .from('queues')
        .select('id, name, client_id')
        .eq('id', queueId)
        .maybeSingle();
      if (qErr) throw qErr;
      if (!queue) throw new Error('Queue not found');

      if (confirmName.trim() !== queue.name.trim()) {
        return new Response(JSON.stringify({
          success: false,
          error: 'confirm_name does not match queue name',
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      console.log(`[queue-maintenance] PURGE start queue=${queueId} (${queue.name})`);

      // 1. Collect ids (chat_messages has NO queue_id — only conversation_id)
      const conversationIds = await fetchAllIds(supabase, 'chat_conversations', 'id', { col: 'queue_id', val: queueId });
      const messageIds: string[] = [];
      for (let i = 0; i < conversationIds.length; i += 500) {
        const slice = conversationIds.slice(i, i + 500);
        const pageSize = 1000;
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from('chat_messages')
            .select('id')
            .in('conversation_id', slice)
            .range(from, from + pageSize - 1);
          if (error) { console.warn('[queue-maintenance] msg fetch error:', error.message); break; }
          if (!data || data.length === 0) break;
          for (const r of data) messageIds.push(String((r as { id: string }).id));
          if (data.length < pageSize) break;
          from += pageSize;
        }
      }
      console.log(`[queue-maintenance] conversations=${conversationIds.length} messages=${messageIds.length}`);

      // 2. Cascade DELETE — children first.
      // We DO NOT touch storage files and DO NOT touch chat_contacts.
      const deleted: Record<string, number> = {};

      // children of messages
      deleted['chat_message_reactions'] = await deleteByIn(supabase, 'chat_message_reactions', 'message_id', messageIds);

      // children of conversations
      deleted['chat_mentions'] = await deleteByIn(supabase, 'chat_mentions', 'conversation_id', conversationIds);
      deleted['chat_conversation_history'] = await deleteByIn(supabase, 'chat_conversation_history', 'conversation_id', conversationIds);
      deleted['chat_conversation_tags'] = await deleteByIn(supabase, 'chat_conversation_tags', 'conversation_id', conversationIds);
      deleted['chat_conversation_participants'] = await deleteByIn(supabase, 'chat_conversation_participants', 'conversation_id', conversationIds);
      deleted['chat_conversation_presence'] = await deleteByIn(supabase, 'chat_conversation_presence', 'conversation_id', conversationIds);
      deleted['chat_conversation_summaries'] = await deleteByIn(supabase, 'chat_conversation_summaries', 'conversation_id', conversationIds);
      deleted['chat_csat_responses'] = await deleteByIn(supabase, 'chat_csat_responses', 'conversation_id', conversationIds);
      deleted['chat_ai_classifications'] = await deleteByIn(supabase, 'chat_ai_classifications', 'conversation_id', conversationIds);
      deleted['chat_ai_autoreply_logs'] = await deleteByIn(supabase, 'chat_ai_autoreply_logs', 'conversation_id', conversationIds);
      deleted['chat_automation_logs'] = await deleteByIn(supabase, 'chat_automation_logs', 'conversation_id', conversationIds);
      deleted['chat_call_logs'] = await deleteByIn(supabase, 'chat_call_logs', 'conversation_id', conversationIds);
      deleted['chat_crm_links'] = await deleteByIn(supabase, 'chat_crm_links', 'conversation_id', conversationIds);
      deleted['chat_scheduled_messages'] = await deleteByIn(supabase, 'chat_scheduled_messages', 'conversation_id', conversationIds);
      deleted['chat_bot_flow_runs'] = await deleteByIn(supabase, 'chat_bot_flow_runs', 'conversation_id', conversationIds);
      deleted['chat_webhook_deliveries'] = await deleteByIn(supabase, 'chat_webhook_deliveries', 'conversation_id', conversationIds);

      // main tables
      // chat_messages → no queue_id, delete by conversation_id
      deleted['chat_messages'] = await deleteByIn(supabase, 'chat_messages', 'conversation_id', conversationIds);
      // Delete conversations in batches by id (eq on queue_id can timeout for large queues)
      deleted['chat_conversations'] = await deleteByIn(supabase, 'chat_conversations', 'id', conversationIds);
      // Safety net: catch any conversation that may have been created during purge
      const tail = await deleteByEq(supabase, 'chat_conversations', 'queue_id', queueId);
      deleted['chat_conversations'] += tail;

      console.log(`[queue-maintenance] PURGE done`, { deleted });

      const totalRows = Object.values(deleted).reduce((a, b) => a + b, 0);
      return new Response(JSON.stringify({
        success: true,
        queue: { id: queue.id, name: queue.name },
        files_deleted: 0,
        files_total: 0,
        file_errors: [],
        contacts_preserved: true,
        media_files_preserved: true,
        deleted,
        total_rows: totalRows,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[queue-maintenance] error:', err);
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});