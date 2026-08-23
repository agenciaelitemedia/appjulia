import { useEffect, useMemo, useRef, useState } from 'react';
import { useMvpChatFeed, type MvpChatFeed } from './useMvpChatFeed';
import type { MvpChatFilters, MvpChatTab } from '../api/types';

export type MvpTabKey = 'pending' | 'open' | 'resolved_closed';

/** Atraso para "aquecer" a aba irmã, evitando rajada de requests na entrada. */
const WARMUP_DELAY_MS = 600;

/**
 * As 3 abas como listas independentes:
 * - `pending` e `open` carregam na entrada e continuam vivas em segundo plano;
 * - `resolved_closed` só carrega na primeira ativação (e revalida ao reabrir).
 * Os filtros valem para as 3 listas ao mesmo tempo.
 */
export function useMvpChatTabs(clientId: string | null, filters: MvpChatFilters, initialTab: MvpTabKey = 'open') {
  const [active, setActive] = useState<MvpTabKey>(initialTab);
  const [warm, setWarm] = useState(false);
  const [closedTouched, setClosedTouched] = useState(initialTab === 'resolved_closed');

  // aquece a aba irmã pouco depois da entrada (nunca as duas de uma vez)
  useEffect(() => {
    if (warm || !clientId) return;
    const t = setTimeout(() => setWarm(true), WARMUP_DELAY_MS);
    return () => clearTimeout(t);
  }, [warm, clientId]);

  useEffect(() => {
    if (active === 'resolved_closed') setClosedTouched(true);
  }, [active]);

  const pending = useMvpChatFeed(clientId, filters, {
    status: 'pending' as MvpChatTab,
    enabled: active === 'pending' || warm,
    background: active !== 'pending',
  });

  const open = useMvpChatFeed(clientId, filters, {
    status: 'open' as MvpChatTab,
    enabled: active === 'open' || warm,
    background: active !== 'open',
  });

  const closed = useMvpChatFeed(clientId, filters, {
    status: 'resolved_closed' as MvpChatTab,
    enabled: closedTouched,
    background: active !== 'resolved_closed',
  });

  const feeds = useMemo(() => ({ pending, open, resolved_closed: closed }), [pending, open, closed]);
  const activeFeed: MvpChatFeed = feeds[active];

  // contadores: usam os counters de qualquer lista já carregada (são globais)
  const lastCounters = useRef(activeFeed.counters);
  const counters = activeFeed.counters ?? pending.counters ?? open.counters ?? closed.counters ?? lastCounters.current;
  lastCounters.current = counters;

  return { active, setActive: setActive as (t: MvpTabKey) => void, feeds, activeFeed, counters };
}
