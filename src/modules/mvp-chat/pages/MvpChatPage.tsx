import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, MessageSquare, Radio } from 'lucide-react';
import { Badge, Button, MascoteLoader, Skeleton, cn } from '../extend/ui';
import { useAuth } from '../extend/auth';
import { useMvpChatFeed } from '../hooks/useMvpChatFeed';
import { useMvpChatOptions } from '../hooks/useMvpChatOptions';
import { MvpChatRow } from '../components/MvpChatRow';
import { MvpChatFiltersBar } from '../components/MvpChatFilters';
import { MvpChatPerfPanel } from '../components/MvpChatPerfPanel';
import { MvpChatDetailsPanel } from '../components/MvpChatDetailsPanel';
import { DEFAULT_MVP_FILTERS, type MvpChatFilters, type MvpChatRowData } from '../api/types';

export default function MvpChatPage() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : null;

  const [filters, setFilters] = useState<MvpChatFilters>(DEFAULT_MVP_FILTERS);
  const [debounced, setDebounced] = useState<MvpChatFilters>(DEFAULT_MVP_FILTERS);
  const [selected, setSelected] = useState<MvpChatRowData | null>(null);

  // debounce só na busca; os demais filtros aplicam imediatamente
  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters), filters.search ? 350 : 0);
    return () => clearTimeout(t);
  }, [filters]);

  const feed = useMvpChatFeed(clientId, debounced);
  const { queues, tags, owners, juliaStages } = useMvpChatOptions(clientId);

  const patch = useCallback((p: Partial<MvpChatFilters>) => setFilters((f) => ({ ...f, ...p })), []);
  const reset = useCallback(() => setFilters(DEFAULT_MVP_FILTERS), []);

  // scroll infinito
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) feed.loadMore();
    }, { rootMargin: '240px' });
    io.observe(el);
    return () => io.disconnect();
  }, [feed.loadMore]);

  const c = feed.counters;

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
            resultCount={feed.rows.length}
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

        <div className="thin-scrollbar min-h-[120px] flex-1 overflow-y-auto px-1 py-1">
          {feed.error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {feed.error}
            </div>
          )}

          {feed.loading ? (
            <div className="space-y-2">
              <div className="flex justify-center py-6"><MascoteLoader /></div>
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : feed.rows.length === 0 ? (
            <div className="rounded-xl border bg-card/60 p-6 text-center text-sm text-muted-foreground">
              Nenhuma conversa para os filtros atuais.
            </div>
          ) : (
            <div className="space-y-[2px]">
              {feed.rows.map((row) => (
                <MvpChatRow
                  key={row.conversation_id}
                  row={row}
                  selected={selected?.conversation_id === row.conversation_id}
                  onSelect={setSelected}
                />
              ))}

              <div ref={sentinel} className="h-8" />
              {feed.loadingMore && <div className="flex justify-center py-2"><MascoteLoader /></div>}
              {!feed.loading && !feed.hasMore && feed.rows.length > 0 && (
                <p className="pb-4 text-center text-[11px] text-muted-foreground">Fim da lista.</p>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Coluna 2 — conversa / payload */}
      <main className="hidden min-w-0 flex-1 flex-col overflow-hidden lg:flex xl:border-r">
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
          <Badge variant="secondary" className="gap-1 text-[11px]">
            <Radio className="h-3 w-3 animate-pulse text-emerald-500" aria-hidden /> tempo real
          </Badge>
          {feed.revalidating && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden /> atualizando…
            </span>
          )}
          {feed.liveEvents > 0 && (
            <Button variant="secondary" size="sm" className="h-8 gap-1 text-[11px]" onClick={feed.refresh}>
              {feed.liveEvents} novidade(s) — atualizar
            </Button>
          )}

          <Button variant="outline" size="sm" className="ml-auto gap-1" onClick={feed.refresh} disabled={feed.loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', feed.loading && 'animate-spin')} aria-hidden /> Recarregar
          </Button>
        </div>

        <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <MvpChatPerfPanel timings={feed.timings} requests={feed.requests} rowsLoaded={feed.rows.length} />

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
