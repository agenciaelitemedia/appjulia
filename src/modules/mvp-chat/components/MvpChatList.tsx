import { useEffect, useRef, useState } from 'react';
import {
  MascoteLoader, Skeleton, cn,
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../extend/ui';
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
  /** Filas offline (mesma regra do /chat): conversa fica destacada e bloqueada. */
  disconnectedQueueIds?: Set<string>;
}

/** Lista de uma aba — estado, scroll e paginação próprios. */
export function MvpChatList({
  feed, visible, accent, selectedId, onSelect, disconnectedQueueIds,
}: Props) {
  const sentinel = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(feed.loadMore);
  loadMoreRef.current = feed.loadMore;
  const [offlineRow, setOfflineRow] = useState<MvpChatRowData | null>(null);

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

  const isDisconnected = (row: MvpChatRowData) =>
    !!row.queue_id && !!disconnectedQueueIds?.has(row.queue_id);

  const handleSelect = (row: MvpChatRowData) => {
    if (isDisconnected(row)) {
      setOfflineRow(row);
      return;
    }
    onSelect(row);
  };

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'thin-scrollbar relative min-h-[120px] flex-1 overflow-y-auto',
        "before:sticky before:top-0 before:z-10 before:block before:h-[2px] before:-mb-[2px] before:content-['']",
        accent === 'amber' && 'before:bg-amber-500/70',
        accent === 'emerald' && 'before:bg-emerald-500/70',
        accent === 'none' && 'before:bg-transparent',
        !visible && 'hidden',
      )}
    >
      {feed.error && (
        <div className="m-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {feed.error}
        </div>
      )}

      {feed.loading && feed.rows.length === 0 ? (
        <div className="space-y-2 p-2">
          <div className="flex justify-center py-6"><MascoteLoader /></div>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : feed.rows.length === 0 ? (
        <div className="m-2 rounded-xl border bg-card/60 p-6 text-center text-sm text-muted-foreground">
          Nenhuma conversa para os filtros atuais.
        </div>
      ) : (
        <div>
          {feed.rows.map((row) => (
            <MvpChatRow
              key={row.conversation_id}
              row={row}
              accent={accent}
              disconnected={isDisconnected(row)}
              selected={selectedId === row.conversation_id}
              onSelect={handleSelect}
            />
          ))}

          <div ref={sentinel} className="h-8" />
          {feed.loadingMore && <div className="flex justify-center py-2"><MascoteLoader /></div>}
          {!feed.loading && !feed.hasMore && feed.rows.length > 0 && (
            <p className="pb-4 text-center text-[11px] text-muted-foreground">Fim da lista.</p>
          )}
        </div>
      )}

      <AlertDialog open={!!offlineRow} onOpenChange={(v) => { if (!v) setOfflineRow(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fila desconectada</AlertDialogTitle>
            <AlertDialogDescription>
              A fila {offlineRow?.queue_name ? `“${offlineRow.queue_name}”` : 'desta conversa'} está desconectada.
              Reconecte a fila para visualizar e responder este atendimento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setOfflineRow(null)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
