import { useEffect, useRef } from 'react';
import { MascoteLoader, Skeleton, cn } from '../extend/ui';
import { MvpChatRow } from './MvpChatRow';
import type { MvpChatFeed } from '../hooks/useMvpChatFeed';
import type { MvpChatRowData } from '../api/types';

interface Props {
  feed: MvpChatFeed;
  /** Aba visível? A inativa fica montada (com `hidden`) para preservar scroll. */
  visible: boolean;
  accent: 'amber' | 'emerald' | 'none';
  selectedId: string | null;
  onSelect: (row: MvpChatRowData) => void;
}

/** Lista de uma aba — estado, scroll e paginação próprios. */
export function MvpChatList({ feed, visible, accent, selectedId, onSelect }: Props) {
  const sentinel = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(feed.loadMore);
  loadMoreRef.current = feed.loadMore;

  useEffect(() => {
    if (!visible) return;
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMoreRef.current();
    }, { rootMargin: '240px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'thin-scrollbar relative min-h-[120px] flex-1 overflow-y-auto px-1 py-1',
        "before:sticky before:top-0 before:z-10 before:block before:h-[2px] before:-mb-[2px] before:content-['']",
        accent === 'amber' && 'before:bg-amber-500/70',
        accent === 'emerald' && 'before:bg-emerald-500/70',
        accent === 'none' && 'before:bg-transparent',
        !visible && 'hidden',
      )}
    >
      {feed.error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {feed.error}
        </div>
      )}

      {feed.loading && feed.rows.length === 0 ? (
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
              selected={selectedId === row.conversation_id}
              onSelect={onSelect}
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
  );
}
