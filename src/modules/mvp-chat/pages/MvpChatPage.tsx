import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, MessageSquare, Radio } from 'lucide-react';
import { Badge, Button, cn } from '../extend/ui';
import { useAuth } from '../extend/auth';
import { useAccessibleQueues, isOwnerUser } from '../extend/queues';
import { MvpChatRealtimeProvider } from '../hooks/useMvpChatRealtimeHub';
import { useMvpChatTabs, type MvpTabKey } from '../hooks/useMvpChatTabs';
import { useMvpChatOptions } from '../hooks/useMvpChatOptions';
import { MvpChatList } from '../components/MvpChatList';
import { MvpChatFiltersBar } from '../components/MvpChatFilters';
import { MvpChatPerfPanel } from '../components/MvpChatPerfPanel';
import { MvpChatDetailsPanel } from '../components/MvpChatDetailsPanel';
import { MvpChatStatusTabs } from '../components/MvpChatStatusTabs';
import { DEFAULT_MVP_FILTERS, type MvpChatFilters, type MvpChatRowData } from '../api/types';

export default function MvpChatPage() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : null;

  return (
    <MvpChatRealtimeProvider clientId={clientId}>
      <MvpChatContent clientId={clientId} />
    </MvpChatRealtimeProvider>
  );
}

function MvpChatContent({ clientId }: { clientId: string | null }) {
  const { user, isAdmin } = useAuth();
  const [filters, setFilters] = useState<MvpChatFilters>(DEFAULT_MVP_FILTERS);
  const [debounced, setDebounced] = useState<MvpChatFilters>(DEFAULT_MVP_FILTERS);
  const [selected, setSelected] = useState<MvpChatRowData | null>(null);

  // debounce só na busca; os demais filtros aplicam imediatamente
  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters), filters.search ? 350 : 0);
    return () => clearTimeout(t);
  }, [filters]);

  // Escopo idêntico ao do /chat: filas ativas acessíveis ao usuário + regra de
  // visibilidade de "em atendimento" para perfis não privilegiados.
  const { data: accessibleQueues = [], isLoading: queuesLoading } = useAccessibleQueues(false);
  const scopeQueueIds = useMemo(
    () => (accessibleQueues as { id: string }[]).map((q) => q.id),
    [accessibleQueues],
  );
  const restrictOpenTo = useMemo<string[] | null>(() => {
    const privileged = isAdmin || isOwnerUser(user);
    if (privileged) return null;
    return [String(user?.id ?? ''), String((user as any)?.name ?? '')].filter(Boolean);
  }, [isAdmin, user]);

  const scopedFilters = useMemo<MvpChatFilters>(() => ({
    ...debounced,
    scope_queue_ids: scopeQueueIds,
    hide_snoozed: true,
    restrict_open_to: restrictOpenTo,
  }), [debounced, scopeQueueIds, restrictOpenTo]);

  const { active, setActive, feeds, activeFeed, counters } = useMvpChatTabs(
    queuesLoading ? null : clientId,
    scopedFilters,
    'open',
  );
  const { queues: allQueues, tags, owners, juliaStages } = useMvpChatOptions(clientId);
  // Só filas dentro do escopo acessível ao usuário aparecem no filtro.
  const queues = useMemo(
    () => (scopeQueueIds.length ? allQueues.filter((q) => scopeQueueIds.includes(q.id)) : allQueues),
    [allQueues, scopeQueueIds],
  );

  const patch = useCallback((p: Partial<MvpChatFilters>) => setFilters((f) => ({ ...f, ...p })), []);
  const reset = useCallback(() => setFilters(DEFAULT_MVP_FILTERS), []);

  const c = counters;

  return (
    <div className="flex h-full min-h-0 overflow-hidden border-y bg-card/40 backdrop-blur-sm">
      {/* Coluna 1 — lista de conversas */}
      <aside className="flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-r lg:w-[400px]">
        <div className="thin-scrollbar max-h-[60%] shrink-0 space-y-2 overflow-y-auto border-b px-2.5 py-2">

          <div className="flex items-center gap-2">
            <MessageSquare className="h-4.5 w-4.5 text-primary" aria-hidden />
            <h1 className="text-base font-bold">MVP Chat</h1>
            <Badge variant="outline" className="ml-auto text-[10px]">protótipo</Badge>
          </div>

          <MvpChatFiltersBar
            filters={filters}
            onChange={patch}
            onReset={reset}
            queues={queues}
            tags={tags}
            juliaStages={juliaStages}
            owners={owners}
            resultCount={activeFeed.rows.length}
          />

          {c && (
            <div className="flex flex-wrap items-center gap-1 text-[10px]">
              <Badge variant="secondary" className="text-[10px]">Total {c.total}</Badge>
              <Badge variant="outline" className="text-[10px]">Aguard. {c.pending}</Badge>
              <Badge variant="outline" className="text-[10px]">Atend. {c.open}</Badge>
              <Badge variant="outline" className="text-[10px]">Resolv. {c.resolved}</Badge>
              <Badge variant="outline" className="text-[10px]">Fech. {c.closed}</Badge>
              <Badge variant="outline" className="text-[10px]">Não lidas {c.unread}</Badge>
              <Badge variant="outline" className="text-[10px] text-destructive">SLA! {c.sla_breached ?? 0}</Badge>
              <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400">Risco {c.sla_at_risk ?? 0}</Badge>
            </div>
          )}
        </div>

        <MvpChatStatusTabs
          value={active}
          onChange={(v) => setActive(v as MvpTabKey)}
          counters={{
            pending: feeds.pending.counters?.pending ?? c?.pending,
            open: feeds.open.counters?.open ?? c?.open,
          }}
        />

        <MvpChatList
          feed={feeds.pending}
          visible={active === 'pending'}
          accent="amber"
          selectedId={selected?.conversation_id ?? null}
          onSelect={setSelected}
        />
        <MvpChatList
          feed={feeds.open}
          visible={active === 'open'}
          accent="emerald"
          selectedId={selected?.conversation_id ?? null}
          onSelect={setSelected}
        />
        <MvpChatList
          feed={feeds.resolved_closed}
          visible={active === 'resolved_closed'}
          accent="none"
          selectedId={selected?.conversation_id ?? null}
          onSelect={setSelected}
        />
      </aside>

      {/* Coluna 2 — conversa / payload */}
      <main className="hidden min-w-0 flex-1 flex-col overflow-hidden lg:flex xl:border-r">
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
          <Badge variant="secondary" className="gap-1 text-[11px]">
            <Radio className="h-3 w-3 animate-pulse text-emerald-500" aria-hidden /> tempo real
          </Badge>
          {activeFeed.revalidating && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden /> atualizando…
            </span>
          )}
          {activeFeed.liveEvents > 0 && (
            <Button variant="secondary" size="sm" className="h-8 gap-1 text-[11px]" onClick={activeFeed.refresh}>
              {activeFeed.liveEvents} novidade(s) — atualizar
            </Button>
          )}

          <Button variant="outline" size="sm" className="ml-auto gap-1" onClick={activeFeed.refresh} disabled={activeFeed.loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', activeFeed.loading && 'animate-spin')} aria-hidden /> Recarregar
          </Button>
        </div>

        <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <MvpChatPerfPanel timings={activeFeed.timings} requests={activeFeed.requests} rowsLoaded={activeFeed.rows.length} />

          {selected ? (
            <pre className="overflow-auto rounded-xl border bg-muted/40 p-3 text-[10px] leading-relaxed">
              {JSON.stringify(selected, null, 2)}
            </pre>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-40" aria-hidden />
              <p className="text-sm">Selecione uma conversa na lista para ver os detalhes.</p>
            </div>
          )}
        </div>
      </main>

      {/* Coluna 3 — detalhes do contato / CRM */}
      <aside className="hidden h-full w-[420px] shrink-0 overflow-hidden xl:block">
        <MvpChatDetailsPanel row={selected} />
      </aside>
    </div>
  );
}

