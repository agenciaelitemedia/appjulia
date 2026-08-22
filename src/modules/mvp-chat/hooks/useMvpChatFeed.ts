import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMvpChatFeed } from '../api/fetchMvpChatFeed';
import type { MvpChatCounters, MvpChatFilters, MvpChatRowData, MvpChatTimings } from '../api/types';

const PAGE_SIZE = 30;

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

/**
 * Feed do MVP: 1 request por página. Nenhuma hidratação posterior — o card
 * chega pronto, então não há "pop-in" de badges.
 */
export function useMvpChatFeed(clientId: string | null, filters: MvpChatFilters) {
  const [state, setState] = useState<State>(INITIAL);
  const reqId = useRef(0);
  const key = useMemo(() => JSON.stringify(filters), [filters]);

  const load = useCallback(async (offset: number, mode: 'replace' | 'append') => {
    if (!clientId) return;
    const id = ++reqId.current;
    setState((s) => ({
      ...s,
      loading: mode === 'replace',
      loadingMore: mode === 'append',
      error: null,
    }));
    try {
      const res = await fetchMvpChatFeed({ clientId, filters, limit: PAGE_SIZE, offset });
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

  const refresh = useCallback(() => { void load(0, 'replace'); }, [load]);

  return { ...state, loadMore, refresh, pageSize: PAGE_SIZE };
}
