import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, MessageSquare } from 'lucide-react';
import { Badge, Button, MascoteLoader, Separator, Skeleton, cn } from '../extend/ui';
import { useAuth } from '../extend/auth';
import { useMvpChatFeed } from '../hooks/useMvpChatFeed';
import { useMvpChatOptions } from '../hooks/useMvpChatOptions';
import { MvpChatRow } from '../components/MvpChatRow';
import { MvpChatFiltersBar } from '../components/MvpChatFilters';
import { MvpChatPerfPanel } from '../components/MvpChatPerfPanel';
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
  const { queues, tags } = useMvpChatOptions(clientId);

  const juliaStages = useMemo(() => {
    const map = new Map<string, string>();
    feed.rows.forEach((r) => {
      if (r.julia_stage_name && r.julia_stage_id != null) map.set(String(r.julia_stage_id), r.julia_stage_name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [feed.rows]);

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
    <>
      <div className="space-y-4 p-4">
        <header className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">MVP — Lista de conversas (query única)</h1>
          </div>
          <Badge variant="outline" className="text-[11px]">protótipo</Badge>
          <Button variant="outline" size="sm" className="ml-auto gap-1" onClick={feed.refresh} disabled={feed.loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', feed.loading && 'animate-spin')} /> Recarregar
          </Button>
        </header>

        <p className="text-xs text-muted-foreground">
          Cada página da lista faz <strong>1 chamada HTTP</strong> → 1 SQL no Supabase (conversa líder + etiquetas +
          ticket + CRM Builder) e 1 SQL no banco legado (CRM da Júlia, sessão e Meta Ads). Todos os filtros são
          aplicados no servidor, então a paginação e os totalizadores ficam sempre coerentes.
        </p>

        <MvpChatPerfPanel timings={feed.timings} requests={feed.requests} rowsLoaded={feed.rows.length} />

        <MvpChatFiltersBar
          filters={filters}
          onChange={patch}
          onReset={reset}
          queues={queues}
          tags={tags}
          juliaStages={juliaStages}
        />

        {c && (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Badge variant="secondary">Total {c.total}</Badge>
            <Badge variant="outline">Aguardando {c.pending}</Badge>
            <Badge variant="outline">Atendimento {c.open}</Badge>
            <Badge variant="outline">Resolvidas {c.resolved}</Badge>
            <Badge variant="outline">Fechadas {c.closed}</Badge>
            <Badge variant="outline">Não lidas {c.unread}</Badge>
          </div>
        )}

        <Separator />

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
          <div className="rounded-xl border bg-card/60 p-10 text-center text-sm text-muted-foreground">
            Nenhuma conversa para os filtros atuais.
          </div>
        ) : (
          <div className="grid gap-[2px] lg:grid-cols-2">
            {feed.rows.map((row) => (
              <MvpChatRow
                key={row.conversation_id}
                row={row}
                selected={selected?.conversation_id === row.conversation_id}
                onSelect={setSelected}
              />
            ))}
          </div>
        )}

        <div ref={sentinel} className="h-8" />
        {feed.loadingMore && <div className="flex justify-center py-2"><MascoteLoader /></div>}
        {!feed.loading && !feed.hasMore && feed.rows.length > 0 && (
          <p className="pb-6 text-center text-[11px] text-muted-foreground">Fim da lista.</p>
        )}

        {selected && (
          <pre className="max-h-72 overflow-auto rounded-xl border bg-muted/40 p-3 text-[10px] leading-relaxed">
            {JSON.stringify(selected, null, 2)}
          </pre>
        )}
      </div>
    </>
  );
}
