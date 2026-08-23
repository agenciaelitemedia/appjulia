import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMvpChatFeed } from '../api/fetchMvpChatFeed';
import { useMvpChatRealtime } from './useMvpChatRealtime';
import type { MvpChatCounters, MvpChatFilters, MvpChatRowData, MvpChatTab, MvpChatTimings } from '../api/types';

const PAGE_SIZE = 30;
/** Espera antes de revalidar após um evento que pode afetar o filtro ativo. */
const REFETCH_DEBOUNCE_MS = 4000;
/** Intervalo mínimo entre revalidações automáticas da lista visível. */
const MIN_REVALIDATE_INTERVAL_MS = 15000;
/** Intervalo mínimo quando a lista está em segundo plano (aba não ativa). */
const MIN_REVALIDATE_INTERVAL_BG_MS = 45000;
/** Idade a partir da qual reabrir a aba dispara revalidação silenciosa. */
const STALE_AFTER_MS = 30000;

/** Campos cuja mudança pode tirar/entrar a conversa no filtro ativo. */
const FILTER_FIELDS = ['queue_id', 'assigned_to', 'assigned_user_id', 'priority'] as const;

interface State {
  rows: MvpChatRowData[];
  counters: MvpChatCounters | null;
  timings: MvpChatTimings | null;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  revalidating: boolean;
  error: string | null;
  requests: number;
}

const INITIAL: State = {
  rows: [], counters: null, timings: null, hasMore: false,
  loading: false, loadingMore: false, revalidating: false, error: null, requests: 0,
};

function whenOf(r: MvpChatRowData) {
  return new Date(r.last_message_at ?? r.conversation_updated_at ?? 0).getTime();
}

const SLA_RANK: Record<string, number> = { breached: 0, at_risk: 1, on_track: 2 };

/**
 * Comparador equivalente ao `ORDER BY` do servidor, para que os patches de
 * tempo real não embaralhem a lista quando a ordenação não é "mais recentes".
 */
function comparatorFor(sort: MvpChatFilters['sort']) {
  return (a: MvpChatRowData, b: MvpChatRowData) => {
    let d = 0;
    if (sort === 'oldest') {
      d = whenOf(a) - whenOf(b);
    } else if (sort === 'unread') {
      d = (b.unread_count ?? 0) - (a.unread_count ?? 0) || whenOf(b) - whenOf(a);
    } else if (sort === 'sla') {
      const ra = SLA_RANK[a.sla_status ?? ''] ?? 3;
      const rb = SLA_RANK[b.sla_status ?? ''] ?? 3;
      d = ra - rb
        || (a.sla_remaining_minutes ?? Number.POSITIVE_INFINITY) - (b.sla_remaining_minutes ?? Number.POSITIVE_INFINITY)
        || whenOf(b) - whenOf(a);
    } else {
      d = whenOf(b) - whenOf(a);
    }
    if (d !== 0) return d;
    // desempate determinístico igual ao do servidor
    return a.conversation_id < b.conversation_id ? 1 : a.conversation_id > b.conversation_id ? -1 : 0;
  };
}

/** A conversa pertence a esta lista? */
function matchesTab(status: string | null | undefined, tab: MvpChatTab) {
  if (!tab) return true;
  if (tab === 'resolved_closed') return status === 'resolved' || status === 'closed';
  return status === tab;
}

export interface UseMvpChatFeedOptions {
  /** Aba/lista desta instância. */
  status: MvpChatTab;
  /** Quando false, a lista não carrega nem revalida (aba nunca aberta). */
  enabled?: boolean;
  /** Lista em segundo plano: nunca mostra loading e revalida com folga. */
  background?: boolean;
}

/**
 * Uma lista do MVP (uma aba): 1 request por página + patches incrementais via
 * Realtime. Revalidações automáticas são silenciosas, com debounce e intervalo
 * mínimo; aba do navegador oculta não revalida.
 */
export function useMvpChatFeed(
  clientId: string | null,
  filters: MvpChatFilters,
  options: UseMvpChatFeedOptions,
) {
  const { status, enabled = true, background = false } = options;
  const [state, setState] = useState<State>(INITIAL);
  const [liveEvents, setLiveEvents] = useState(0);
  const reqId = useRef(0);
  const lastLoadAt = useRef(0);
  const pendingRevalidate = useRef(false);
  const rowsRef = useRef<MvpChatRowData[]>([]);
  rowsRef.current = state.rows;
  const backgroundRef = useRef(background);
  backgroundRef.current = background;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const effectiveFilters = useMemo<MvpChatFilters>(() => ({ ...filters, status }), [filters, status]);
  const key = useMemo(() => JSON.stringify(effectiveFilters), [effectiveFilters]);

  const load = useCallback(async (
    offset: number,
    mode: 'replace' | 'append',
    opts: { refresh?: boolean; silent?: boolean } = {},
  ) => {
    if (!clientId) return;
    const { refresh = false, silent = false } = opts;
    const showLoading = mode === 'replace' && !silent && !backgroundRef.current;
    const id = ++reqId.current;
    lastLoadAt.current = Date.now();
    setState((s) => ({
      ...s,
      loading: showLoading,
      revalidating: !showLoading && mode === 'replace',
      loadingMore: mode === 'append',
      error: null,
    }));
    try {
      const res = await fetchMvpChatFeed({ clientId, filters: effectiveFilters, limit: PAGE_SIZE, offset, refresh });
      if (id !== reqId.current) return;
      setState((s) => ({
        rows: mode === 'append' ? [...s.rows, ...res.rows] : res.rows,
        counters: res.counters,
        timings: res.timings,
        hasMore: res.has_more,
        loading: false,
        loadingMore: false,
        revalidating: false,
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
        revalidating: false,
        error: (e as Error)?.message ?? 'Falha ao carregar o feed',
        requests: s.requests + 1,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, key]);

  const loadRef = useRef(load);
  loadRef.current = load;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* --------- carga inicial / recarga por filtro / reabertura da aba --------- */
  const loadedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!clientId || !enabled) return;
    if (loadedKey.current !== key) {
      loadedKey.current = key;
      void loadRef.current(0, 'replace');
      return;
    }
    // aba reaberta com dados já carregados: revalida em silêncio se estiver velho
    if (Date.now() - lastLoadAt.current > STALE_AFTER_MS) {
      void loadRef.current(0, 'replace', { silent: true });
    }
  }, [clientId, enabled, key]);

  const loadMore = useCallback(() => {
    if (state.loading || state.loadingMore || !state.hasMore) return;
    void load(state.rows.length, 'append');
  }, [load, state.hasMore, state.loading, state.loadingMore, state.rows.length]);

  const refresh = useCallback(() => { void load(0, 'replace', { refresh: true }); }, [load]);

  /* ------------------------------ tempo real ------------------------------ */
  const runRevalidate = useCallback(() => {
    if (!enabledRef.current) { pendingRevalidate.current = true; return; }
    if (typeof document !== 'undefined' && document.hidden) {
      pendingRevalidate.current = true;
      return;
    }
    const minInterval = backgroundRef.current ? MIN_REVALIDATE_INTERVAL_BG_MS : MIN_REVALIDATE_INTERVAL_MS;
    const since = Date.now() - lastLoadAt.current;
    if (since < minInterval) {
      pendingRevalidate.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        pendingRevalidate.current = false;
        void loadRef.current(0, 'replace', { silent: true });
      }, minInterval - since);
      return;
    }
    pendingRevalidate.current = false;
    void loadRef.current(0, 'replace', { silent: true });
  }, []);

  const scheduleRefetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runRevalidate, REFETCH_DEBOUNCE_MS);
  }, [runRevalidate]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // volta o foco / a aba reativa: uma única revalidação se ficou algo pendente
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && enabledRef.current && pendingRevalidate.current) runRevalidate();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [runRevalidate]);

  useEffect(() => {
    if (enabled && pendingRevalidate.current) runRevalidate();
  }, [enabled, runRevalidate]);

  const onMessage = useCallback((msg: any) => {
    if (!msg?.conversation_id) return;
    const known = rowsRef.current.some((r) => r.conversation_id === msg.conversation_id);
    if (!known) return; // conversa fora desta lista: nada a patchear aqui
    setState((s) => {
      const idx = s.rows.findIndex((r) => r.conversation_id === msg.conversation_id);
      if (idx < 0) return s;
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
      rows.sort((a, b) => whenOf(b) - whenOf(a));
      const counters = s.counters
        ? { ...s.counters, unread: fromMe ? s.counters.unread : (s.counters.unread ?? 0) + 1 }
        : s.counters;
      return { ...s, rows, counters };
    });
  }, []);

  const onConversation = useCallback((conv: any, eventType: 'INSERT' | 'UPDATE', old?: any) => {
    if (!conv?.id) return;
    const current = rowsRef.current.find((r) => r.conversation_id === conv.id);
    const known = !!current;

    const nextStatus = conv.status === 'pending' && (conv.assigned_to ?? '') !== '' ? 'open' : conv.status;
    const belongs = matchesTab(nextStatus, status);

    // saiu desta lista: remove a linha na hora, sem request
    if (known && !belongs) {
      setState((s) => {
        const rows = s.rows.filter((r) => r.conversation_id !== conv.id);
        if (rows.length === s.rows.length) return s;
        return { ...s, rows };
      });
      return;
    }

    // entrou nesta lista (ou conversa nova): precisa buscar a linha hidratada
    if (!known) {
      if (!belongs) return;
      setLiveEvents((n) => n + 1);
      scheduleRefetch();
      return;
    }

    setState((s) => {
      const idx = s.rows.findIndex((r) => r.conversation_id === conv.id);
      if (idx < 0) return s;
      const row = s.rows[idx];
      const rows = [...s.rows];
      rows[idx] = {
        ...row,
        status: (nextStatus ?? row.status) as MvpChatRowData['status'],
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

    if (eventType === 'INSERT') {
      scheduleRefetch();
      return;
    }

    // atualização de conversa conhecida: só revalida se um campo de filtro mudou
    const before = old && Object.keys(old).length > 0 ? old : {
      queue_id: current!.queue_id,
      assigned_to: current!.assigned_to,
      assigned_user_id: current!.assigned_user_id,
      priority: current!.priority,
    };
    const filterChanged = FILTER_FIELDS.some(
      (f) => (before as any)[f] !== undefined && (before as any)[f] !== conv[f],
    );
    if (filterChanged) scheduleRefetch();
  }, [scheduleRefetch, status]);

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

export type MvpChatFeed = ReturnType<typeof useMvpChatFeed>;
