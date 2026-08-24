import { useEffect, useMemo, useRef, useState } from 'react';
import { useJuliaChatFeed, type JuliaChatFeed } from './useJuliaChatFeed';
import type { JuliaChatFilters, JuliaChatTab } from '../api/types';

export type JuliaTabKey = 'pending' | 'open' | 'resolved_closed';

/** Atraso para "aquecer" a aba irmã, evitando rajada de requests na entrada. */
const WARMUP_DELAY_MS = 600;

/**
 * As 3 abas como listas independentes:
 * - `pending` e `open` carregam na entrada e continuam vivas em segundo plano;
 * - `resolved_closed` só carrega na primeira ativação (e revalida ao reabrir).
 * Os filtros valem para as 3 listas ao mesmo tempo.
 */
export function useJuliaChatTabs(clientId: string | null, filters: JuliaChatFilters, initialTab: JuliaTabKey = 'open') {
  const [active, setActive] = useState<JuliaTabKey>(initialTab);
  const [warm, setWarm] = useState(false);
  const [closedTouched, setClosedTouched] = useState(initialTab === 'resolved_closed');

  // aquece a aba irmã pouco depois da entrada (nunca as duas de uma vez)
  useEffect(() => {
    if (warm || !clientId) return;
    const t = setTimeout(() => setWarm(true), WARMUP_DELAY_MS);
    return () => clearTimeout(t);
  }, [warm, clientId]);

  // Busca ativa: carrega também a aba Encerradas, para que o resultado apareça
  // (e o contador da aba fique visível) mesmo sem o usuário abrir a aba.
  const searching = (filters.search ?? '').trim().length > 0;

  useEffect(() => {
    if (active === 'resolved_closed' || searching) setClosedTouched(true);
  }, [active, searching]);

  const pending = useJuliaChatFeed(clientId, filters, {
    status: 'pending' as JuliaChatTab,
    enabled: active === 'pending' || warm,
    background: active !== 'pending',
  });

  const open = useJuliaChatFeed(clientId, filters, {
    status: 'open' as JuliaChatTab,
    enabled: active === 'open' || warm,
    background: active !== 'open',
  });

  const closed = useJuliaChatFeed(clientId, filters, {
    status: 'resolved_closed' as JuliaChatTab,
    enabled: closedTouched,
    background: active !== 'resolved_closed',
  });

  const feeds = useMemo(() => ({ pending, open, resolved_closed: closed }), [pending, open, closed]);
  const activeFeed: JuliaChatFeed = feeds[active];

  // contadores: usam os counters de qualquer lista já carregada (são globais)
  const lastCounters = useRef(activeFeed.counters);
  const counters = activeFeed.counters ?? pending.counters ?? open.counters ?? closed.counters ?? lastCounters.current;
  lastCounters.current = counters;

  /** Remove a conversa de todas as abas (ex.: adiamento otimista). */
  const removeRowEverywhere = (conversationId: string) => {
    pending.removeRow(conversationId);
    open.removeRow(conversationId);
    closed.removeRow(conversationId);
  };

  return { active, setActive: setActive as (t: JuliaTabKey) => void, feeds, activeFeed, counters, removeRowEverywhere };

}
