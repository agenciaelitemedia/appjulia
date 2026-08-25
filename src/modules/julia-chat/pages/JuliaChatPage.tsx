import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, MessageSquare, Radio } from 'lucide-react';
import { Badge, Button, cn } from '../extend/ui';
import { useAuth } from '../extend/auth';
import { useAccessibleQueues, isOwnerUser, useQueueConnectionStatusesBatch } from '../extend/queues';
import { JuliaChatRealtimeProvider } from '../hooks/useJuliaChatRealtimeHub';
import { useJuliaChatTabs, type JuliaTabKey } from '../hooks/useJuliaChatTabs';
import { useJuliaSnoozed } from '../hooks/useJuliaSnoozed';
import { useSnoozeExpiryWatcher } from '../hooks/useSnoozeExpiryWatcher';

import { useJuliaChatOptions } from '../hooks/useJuliaChatOptions';
import { JuliaChatList } from '../components/JuliaChatList';
import { JuliaChatFiltersBar } from '../components/JuliaChatFilters';
import { JuliaChatPerfPanel } from '../components/JuliaChatPerfPanel';
import { JuliaChatStatusTabs } from '../components/JuliaChatStatusTabs';
import { JuliaSnoozedPanel } from '../components/JuliaSnoozedPanel';
import { JuliaChatConversation } from '../components/JuliaChatConversation';
import { JuliaChatRightBar } from '../components/JuliaChatRightBar';
import { WhatsAppDataProvider } from '../extend/chat';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../extend/ui';
import { DEFAULT_JULIA_FILTERS, type JuliaChatFilters, type JuliaChatRowData } from '../api/types';
import { APP_VERSION_LABEL } from '@/lib/appVersionLabel';

export default function JuliaChatPage() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : null;

  return (
    <JuliaChatRealtimeProvider clientId={clientId}>
      <JuliaChatContent clientId={clientId} />
    </JuliaChatRealtimeProvider>
  );
}

function JuliaChatContent({ clientId }: { clientId: string | null }) {
  const { user, isAdmin } = useAuth();
  const [filters, setFilters] = useState<JuliaChatFilters>(DEFAULT_JULIA_FILTERS);
  const [debounced, setDebounced] = useState<JuliaChatFilters>(DEFAULT_JULIA_FILTERS);
  const [selected, setSelected] = useState<JuliaChatRowData | null>(null);
  const [snoozedPanelOpen, setSnoozedPanelOpen] = useState(false);

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
  // Status de conexão das filas (mesma checagem do /chat).
  const { statusMap: queueConnectionMap } = useQueueConnectionStatusesBatch(accessibleQueues as any);
  const disconnectedQueueIds = useMemo(() => {
    const set = new Set<string>();
    queueConnectionMap.forEach((connected, queueId) => {
      if (connected === false) set.add(queueId);
    });
    return set;
  }, [queueConnectionMap]);

  const restrictOpenTo = useMemo<string[] | null>(() => {
    const privileged = isAdmin || isOwnerUser(user);
    if (privileged) return null;
    return [String(user?.id ?? ''), String((user as any)?.name ?? '')].filter(Boolean);
  }, [isAdmin, user]);

  const scopedFilters = useMemo<JuliaChatFilters>(() => ({
    ...debounced,
    scope_queue_ids: scopeQueueIds,
    hide_snoozed: debounced.hide_snoozed ?? true,
    restrict_open_to: restrictOpenTo,
  }), [debounced, scopeQueueIds, restrictOpenTo]);

  const { active, setActive, feeds, activeFeed, counters, removeRowEverywhere } = useJuliaChatTabs(
    queuesLoading ? null : clientId,
    scopedFilters,
    'open',
  );
  const { queues: allQueues, tags, owners, juliaStages } = useJuliaChatOptions(clientId);
  // Só filas dentro do escopo acessível ao usuário aparecem no filtro.
  const queues = useMemo(
    () => (scopeQueueIds.length ? allQueues.filter((q) => scopeQueueIds.includes(q.id)) : allQueues),
    [allQueues, scopeQueueIds],
  );

  const patch = useCallback((p: Partial<JuliaChatFilters>) => setFilters((f) => ({ ...f, ...p })), []);
  const reset = useCallback(() => setFilters(DEFAULT_JULIA_FILTERS), []);

  // Conversas adiadas ativas: buscadas direto no banco (mesma regra do /chat),
  // independentes da paginação do feed (que oculta adiados por padrão).
  const { snoozedItems, refetchSnoozed } = useJuliaSnoozed(clientId, scopeQueueIds);
  const snoozedCount = snoozedItems.length;

  // Avisa na interface quando um adiamento expira e a conversa volta à lista.
  useSnoozeExpiryWatcher(snoozedItems, useCallback(() => {
    void refetchSnoozed();
    void feeds.pending.refresh();
    void feeds.open.refresh();
    void feeds.resolved_closed.refresh();
  }, [refetchSnoozed, feeds]));


  const c = counters;

  return (
    <div className="flex h-full min-h-0 overflow-hidden border-y bg-card/40 backdrop-blur-sm">
      {/* Coluna 1 — lista de conversas */}
      <aside className={cn(
        'flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-r lg:w-[400px]',
        selected && 'hidden lg:flex',
      )}>
        <div className="relative z-20 shrink-0 space-y-2 border-b px-2.5 py-2">

          <div className="flex items-center gap-2">
            <MessageSquare className="h-4.5 w-4.5 text-primary" aria-hidden />
            <h1 className="text-base font-bold">JulIA&nbsp;Chat</h1>
            <Badge variant="outline" className="ml-auto text-[10px]">{APP_VERSION_LABEL}</Badge>
          </div>

          <JuliaChatFiltersBar
            filters={filters}
            onChange={patch}
            onReset={reset}
            queues={queues}
            tags={tags}
            juliaStages={juliaStages}
            owners={owners}
            resultCount={activeFeed.rows.length}
            snoozedCount={snoozedCount}
            onOpenSnoozed={() => setSnoozedPanelOpen(true)}
          />
        </div>


        <JuliaChatStatusTabs
          value={active}
          onChange={(v) => setActive(v as JuliaTabKey)}
          loading={activeFeed.loading}
          counters={{
            pending: feeds.pending.counters?.pending ?? c?.pending,
            open: feeds.open.counters?.open ?? c?.open,
            // Encerradas: contador do próprio feed (carregado sempre que há busca ativa)
            closed: feeds.resolved_closed.counters?.total,
          }}
        />

        <JuliaChatList
          feed={feeds.pending}
          visible={active === 'pending'}
          tab="pending"
          accent="amber"
          selectedId={selected?.conversation_id ?? null}
          disconnectedQueueIds={disconnectedQueueIds}
          onSelect={setSelected}
        />
        <JuliaChatList
          feed={feeds.open}
          visible={active === 'open'}
          tab="open"
          accent="emerald"
          selectedId={selected?.conversation_id ?? null}
          disconnectedQueueIds={disconnectedQueueIds}
          onSelect={setSelected}
        />
        <JuliaChatList
          feed={feeds.resolved_closed}
          visible={active === 'resolved_closed'}
          tab="resolved_closed"
          accent="none"
          selectedId={selected?.conversation_id ?? null}
          disconnectedQueueIds={disconnectedQueueIds}
          onSelect={setSelected}
        />

        <JuliaNewConversationFooter
          queues={accessibleQueues as any[]}
          queueConnectionMap={queueConnectionMap}
          clientId={clientId}
        />
      </aside>

      {/* Colunas 2 e 3 — conversa real + right-bar (provider isolado do JulIA Chat) */}
      <WhatsAppDataProvider>
        <JuliaConversationColumns
          selected={selected}
          onClearSelection={() => setSelected(null)}
          onSnoozed={(conversationId) => {
            removeRowEverywhere(conversationId);
            setSelected(null);
            void refetchSnoozed();
          }}
          feed={activeFeed}
          activeTab={active}
        />
      </WhatsAppDataProvider>


      <JuliaSnoozedPanel
        open={snoozedPanelOpen}
        onOpenChange={setSnoozedPanelOpen}
        items={snoozedItems}
        onResumed={refetchSnoozed}
        onSelect={setSelected}
      />
    </div>
  );
}


/** true quando a viewport é menor que o breakpoint `lg` (1024px). */
function useIsBelowLg() {
  const [below, setBelow] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < 1024,
  );
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const onChange = () => setBelow(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return below;
}

/**
 * Colunas 2 e 3 do JulIA Chat, dentro do `WhatsAppDataProvider` isolado: a conversa
 * real (header + timeline + input do chat principal) e a right-bar.
 */
function JuliaConversationColumns({
  selected,
  onClearSelection,
  onSnoozed,
  feed,
  activeTab,
}: {
  selected: JuliaChatRowData | null;
  onClearSelection: () => void;
  onSnoozed?: (conversationId: string) => void;
  feed: ReturnType<typeof useJuliaChatTabs>['activeFeed'];
  activeTab: JuliaTabKey;
}) {
  const isBelowLg = useIsBelowLg();
  const [diagOpen, setDiagOpen] = useState(false);

  const target = selected
    ? {
        contactId: selected.contact_id,
        queueId: selected.queue_id ?? null,
        conversationId: selected.conversation_id ?? null,
      }
    : null;

  return (
    <>
      <main className={cn('min-w-0 flex-1 flex-col overflow-hidden lg:flex', target ? 'flex' : 'hidden')}>
        <Collapsible open={diagOpen} onOpenChange={setDiagOpen} className="shrink-0 border-b">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <Radio className="h-3 w-3 animate-pulse text-emerald-500" aria-hidden /> tempo real
            </Badge>
            {feed.revalidating && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden /> atualizando…
              </span>
            )}
            {feed.liveEvents > 0 && (
              <Button variant="secondary" size="sm" className="h-7 gap-1 text-[11px]" onClick={feed.refresh}>
                {feed.liveEvents} novidade(s) — atualizar
              </Button>
            )}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1 text-[11px]">
                Diagnóstico
              </Button>
            </CollapsibleTrigger>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-[11px]"
              onClick={feed.refresh}
              disabled={feed.loading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', feed.loading && 'animate-spin')} aria-hidden /> Recarregar
            </Button>
          </div>
          <CollapsibleContent>
            <div className="px-3 pb-2">
              <JuliaChatPerfPanel timings={feed.timings} requests={feed.requests} rowsLoaded={feed.rows.length} counters={feed.counters} activeTab={activeTab} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {target ? (
            <JuliaChatConversation target={target} onClose={onClearSelection} onSnoozed={onSnoozed} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-40" aria-hidden />
              <p className="text-sm">Selecione uma conversa na lista para abrir o atendimento.</p>
            </div>
          )}
        </div>
      </main>

      <aside className="hidden h-full w-[380px] shrink-0 overflow-hidden lg:block xl:w-[400px] empty:hidden">
        <JuliaChatRightBar row={selected} isBelowLg={isBelowLg} />
      </aside>
    </>
  );
}
