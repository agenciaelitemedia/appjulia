import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ChatConversation } from '@/types/conversation';

const CONV_COLUMNS =
  'id,contact_id,client_id,queue_id,status,priority,assigned_to,cod_agent,updated_at,created_at,opened_at,first_response_at,resolved_at,closed_at,snoozed_until,channel,protocol,close_note';

const PAGE_SIZE = 1000;

function compareConv(a: ChatConversation, b: ChatConversation): number {
  // Newer first: updated_at desc → opened_at desc → created_at desc
  const ua = a.updated_at ? new Date(a.updated_at).getTime() : 0;
  const ub = b.updated_at ? new Date(b.updated_at).getTime() : 0;
  if (ua !== ub) return ub - ua;
  const oa = a.opened_at ? new Date(a.opened_at).getTime() : 0;
  const ob = b.opened_at ? new Date(b.opened_at).getTime() : 0;
  if (oa !== ob) return ob - oa;
  const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
  const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
  return cb - ca;
}

function buildLeaderMap(rows: ChatConversation[], allowedQueueIds: Set<string>): Map<string, ChatConversation> {
  const m = new Map<string, ChatConversation>();
  for (const c of rows) {
    if (!c.contact_id) continue;
    // Ignore conversations whose queue was soft-deleted (mirrors context behavior).
    if (c.queue_id && !allowedQueueIds.has(c.queue_id)) continue;
    const prev = m.get(c.contact_id);
    if (!prev || compareConv(c, prev) < 0) {
      m.set(c.contact_id, c);
    }
  }
  return m;
}

/**
 * Loads ALL conversations of a client (lean columns) and returns, per contact,
 * the most-recent conversation (the "leader"). Kept in sync via a postgres_changes
 * subscription. Used to deduplicate the chat list so each contact appears in
 * exactly one status tab — the tab matching its leader.
 */
export function useContactLatestConversation(
  clientId: string | undefined | null,
  activeQueueIds: string[],
) {
  const [rows, setRows] = useState<ChatConversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Stable serialization of allowed queues — drives effect re-runs only on content change.
  const allowedKey = useMemo(() => [...activeQueueIds].sort().join(','), [activeQueueIds]);
  const allowedSet = useMemo(() => new Set(activeQueueIds), [allowedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const rowsRef = useRef<ChatConversation[]>([]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  const upsertRow = useCallback((row: ChatConversation) => {
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === row.id);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = { ...next[idx], ...row };
        return next;
      }
      return [row, ...prev];
    });
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  }, []);

  // Initial paged load
  useEffect(() => {
    if (!clientId) { setRows([]); return; }
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      const acc: ChatConversation[] = [];
      let from = 0;
      // Hard cap to protect memory on huge clients (max 20 pages = 20k rows).
      for (let i = 0; i < 20; i++) {
        const { data, error } = await supabase
          .from('chat_conversations')
          .select(CONV_COLUMNS)
          .eq('client_id', clientId)
          .order('updated_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          console.error('[useContactLatestConversation] load error', error);
          break;
        }
        const page = (data || []) as unknown as ChatConversation[];
        acc.push(...page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      if (!cancelled) {
        setRows(acc);
        setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  // Realtime subscription
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`contact_latest_conv_${clientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_conversations', filter: `client_id=eq.${clientId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { id?: string };
            if (old?.id) removeRow(old.id);
            return;
          }
          const row = payload.new as ChatConversation;
          if (row && row.id) upsertRow(row);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId, upsertRow, removeRow]);

  const leaderByContact = useMemo(() => buildLeaderMap(rows, allowedSet), [rows, allowedSet]);

  return { leaderByContact, isLoading };
}

export type LeaderGroup = 'active' | 'resolved' | 'closed';

/**
 * Effective tab-group of a leader conversation.
 * - pending / open  → 'active'
 * - pending with assignee → still 'active' (matches context's "effective status" rule)
 * - resolved → 'resolved'
 * - closed → 'closed'
 */
export function leaderGroup(c: ChatConversation | undefined | null): LeaderGroup | null {
  if (!c) return null;
  const s = c.status;
  if (s === 'pending' || s === 'open') return 'active';
  if (s === 'resolved') return 'resolved';
  if (s === 'closed') return 'closed';
  return null;
}
