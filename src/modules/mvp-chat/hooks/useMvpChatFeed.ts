import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMvpChatFeed } from '../api/fetchMvpChatFeed';
import { useMvpChatRealtime } from './useMvpChatRealtime';
import type { MvpChatCounters, MvpChatFilters, MvpChatRowData, MvpChatTimings } from '../api/types';

const PAGE_SIZE = 30;
const REFETCH_DEBOUNCE_MS = 1500;

interface State {
  rows: MvpChatRowData[];
  counters: MvpChatCounters | null;
  timings: MvpChatTimings | null;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  requests: number;
}

const INITIAL: State = {
  rows: [], counters: null, timings: null, hasMore: false,
  loading: false, loadingMore: false, error: null, requests: 0,
};

function whenOf(r: MvpChatRowData) {
  return new Date(r.last_message_at ?? r.conversation_updated_at ?? 0).getTime();
}

/**
 * Feed do MVP: 1 request por página + patches incrementais via Realtime
 * (mensagem nova, conversa e contato atualizados). Sem refetch da página
 * inteira em cada evento.
 */
export function useMvpChatFeed(clientId: string | null, filters: MvpChatFilters) {
  const [state, setState] = useState<State>(INITIAL);
  const [liveEvents, setLiveEvents] = useState(0);
  const reqId = useRef(0);
  const key = useMemo(() => JSON.stringify(filters), [filters]);

  const load = useCallback(async (offset: number, mode: 'replace' | 'append', refresh = false) => {
    if (!clientId) return;
    const id = ++reqId.current;
    setState((s) => ({
      ...s,
      loading: mode === 'replace',
      loadingMore: mode === 'append',
      error: null,
    }));
    try {
      const res = await fetchMvpChatFeed({ clientId, filters, limit: PAGE_SIZE, offset, refresh });
      if (id !== reqId.current) return;
      setState((s) => ({
        rows: mode === 'append' ? [...s.rows, ...res.rows] : res.rows,
        counters: res.counters,
        timings: res.timings,
        hasMore: res.has_more,
        loading: false,
        loadingMore: false,
        error: null,
        requests: s.requests + 1,
      }));
      if (mode === 'replace') setLiveEvents(0);
    } catch (e) {
      if (id !== reqId.current) return;
      setState((s) => ({
        ...s,
        loading: false,
        loadingMore: false,
        error: (e as Error)?.message ?? 'Falha ao carregar o feed',
        requests: s.requests + 1,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, key]);

  useEffect(() => { void load(0, 'replace'); }, [load]);

  const loadMore = useCallback(() => {
    if (state.loading || state.loadingMore || !state.hasMore) return;
    void load(state.rows.length, 'append');
  }, [load, state.hasMore, state.loading, state.loadingMore, state.rows.length]);

  const refresh = useCallback(() => { void load(0, 'replace', true); }, [load]);

  /* ------------------------------ tempo real ------------------------------ */
  const loadRef = useRef(load);
  loadRef.current = load;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void loadRef.current(0, 'replace'); }, REFETCH_DEBOUNCE_MS);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const onMessage = useCallback((msg: any) => {
    if (!msg?.conversation_id) return;
    let known = false;
    setState((s) => {
      const idx = s.rows.findIndex((r) => r.conversation_id === msg.conversation_id);
      if (idx < 0) return s;
      known = true;
      const row = s.rows[idx];
      const fromMe = !!msg.from_me;
      const patched: MvpChatRowData = {
        ...row,
        last_message_text: typeof msg.content === 'string' ? msg.content : row.last_message_text,
        last_message_at: msg.created_at ?? new Date().toISOString(),
        last_message_from_me: fromMe,
        last_customer_message_at: fromMe ? row.last_customer_message_at : (msg.created_at ?? new Date().toISOString()),
        unread_count: fromMe ? row.unread_count : (row.unread_count ?? 0) + 1,
      };
      const rows = [...s.rows];
      rows[idx] = patched;
      // reordena quando a ordenação é temporal
      rows.sort((a, b) => whenOf(b) - whenOf(a));
      const counters = s.counters
        ? { ...s.counters, unread: fromMe ? s.counters.unread : (s.counters.unread ?? 0) + 1 }
        : s.counters;
      return { ...s, rows, counters };
    });
    if (!known) {
      setLiveEvents((n) => n + 1);
      scheduleRefetch();
    }
  }, [scheduleRefetch]);

  const onConversation = useCallback((conv: any, eventType: 'INSERT' | 'UPDATE') => {
    if (!conv?.id) return;
    let known = false;
    setState((s) => {
      const idx = s.rows.findIndex((r) => r.conversation_id === conv.id);
      if (idx < 0) return s;
      known = true;
      const row = s.rows[idx];
      const status = conv.status === 'pending' && (conv.assigned_to ?? '') !== '' ? 'open' : conv.status;
      const rows = [...s.rows];
      rows[idx] = {
        ...row,
        status: (status ?? row.status) as MvpChatRowData['status'],
        assigned_to: conv.assigned_to ?? null,
        assigned_user_id: conv.assigned_user_id ?? null,
        priority: conv.priority ?? row.priority,
        queue_id: conv.queue_id ?? row.queue_id,
        protocol: conv.protocol ?? row.protocol,
        first_response_at: conv.first_response_at ?? row.first_response_at,
        resolved_at: conv.resolved_at ?? null,
        closed_at: conv.closed_at ?? null,
        snoozed_until: conv.snoozed_until ?? null,
        active_ticket_id: conv.active_ticket_id ?? null,
        conversation_updated_at: conv.updated_at ?? row.conversation_updated_at,
      };
      return { ...s, rows };
    });
    // conversa nova, mudança de status/fila/responsável pode afetar o filtro ativo
    if (!known || eventType === 'INSERT') {
      setLiveEvents((n) => n + 1);
      scheduleRefetch();
    } else {
      scheduleRefetch();
    }
  }, [scheduleRefetch]);

  const onContact = useCallback((ct: any) => {
    if (!ct?.id) return;
    setState((s) => {
      const idx = s.rows.findIndex((r) => r.contact_id === ct.id);
      if (idx < 0) return s;
      const rows = [...s.rows];
      rows[idx] = {
        ...rows[idx],
        contact_name: ct.name ?? rows[idx].contact_name,
        avatar: ct.avatar ?? rows[idx].avatar,
        unread_count: typeof ct.unread_count === 'number' ? ct.unread_count : rows[idx].unread_count,
        last_message_text: ct.last_message_text ?? rows[idx].last_message_text,
        last_message_at: ct.last_message_at ?? rows[idx].last_message_at,
      };
      rows.sort((a, b) => whenOf(b) - whenOf(a));
      return { ...s, rows };
    });
  }, []);

  useMvpChatRealtime(clientId, { onMessage, onConversation, onContact });

  return { ...state, loadMore, refresh, pageSize: PAGE_SIZE, liveEvents };
}
