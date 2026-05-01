import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { useAuth } from '@/contexts/AuthContext';
import { MessageBubble } from './MessageBubble';
import { ConversationEvent } from './ConversationEvent';
import { ForwardDialog } from './ForwardDialog';
import { useMessageReactions, sendReaction } from '@/hooks/useMessageReactions';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import type { ChatMessage, ChatContact } from '@/types/chat';
import type { ConversationHistoryEntry } from '@/types/conversation';
import { isEncryptionEnvelope } from '@/lib/chat/envelopeFilter';

interface ChatMessagesProps {
  contactId: string;
  onReply?: (message: ChatMessage) => void;
}

type TimelineItem =
  | { kind: 'message'; data: ChatMessage; ts: number }
  | { kind: 'event'; data: ConversationHistoryEntry; ts: number };

export function ChatMessages({ contactId, onReply }: ChatMessagesProps) {
  const { messages, loadMessages, conversationHistory, loadConversationHistory, selectedConversation, downloadMedia, selectedQueue, contacts, isReady } = useWhatsAppData();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Raw count of messages already fetched from the server for THIS contact,
  // used as the next-page offset. Decoupled from `contactMessages.length`
  // (which is filtered) so pagination stays correct even when notes /
  // envelopes are hidden from the timeline.
  const [loadedCount, setLoadedCount] = useState(0);
  const [hasLoadedFirstPage, setHasLoadedFirstPage] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const prevScrollHeight = useRef(0);
  // Keep a stable reference to loadMessages without re-running the
  // initial-load effect every time the context recreates the callback.
  const loadMessagesRef = useRef(loadMessages);
  useEffect(() => { loadMessagesRef.current = loadMessages; }, [loadMessages]);
  
  const allContactMessages = messages[contactId] || [];

  // Internal notes are scoped per conversation: hide notes that belong to a
  // different conversation than the one currently selected. Legacy notes
  // (without a conversation_id) remain visible to avoid hiding old data.
  const contactMessages = useMemo(() => {
    const currentConvId = selectedConversation?.id ?? null;
    return allContactMessages.filter((m: ChatMessage) => {
      // Hide standalone "encryption notification" envelopes — they carry no
      // useful content for the agent (see src/lib/chat/envelopeFilter.ts).
      if (
        (m?.type === 'text' || !m?.type) &&
        !m?.media_url &&
        isEncryptionEnvelope(m?.text)
      ) {
        return false;
      }
      const isNote = !!(m?.metadata?.internal_note ?? m?.internal_note);
      if (!isNote) return true;
      const noteConvId = m?.conversation_id ?? m?.metadata?.conversation_id ?? null;
      if (!noteConvId) return true; // legacy note → keep
      return currentConvId ? noteConvId === currentConvId : true;
    });
  }, [allContactMessages, selectedConversation?.id]);

  // Load conversation history when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      loadConversationHistory(selectedConversation.id);
    }
  }, [selectedConversation?.id, loadConversationHistory]);

  // Initial load — depends on contactId AND on the parent context being
  // bootstrapped (`isReady`). Without the readiness gate, the fetch could
  // fire while the provider is still resolving client_id / queues /
  // conversations and finish in a state that is later wiped silently,
  // leaving the panel empty until the user navigates away and back.
  useEffect(() => {
    if (!contactId) return;
    if (!isReady) {
      // Stay in loading state — do not mark first page as loaded yet,
      // so the resilience effect below will fire as soon as the context
      // becomes ready.
      setIsLoading(true);
      setHasLoadedFirstPage(false);
      setLoadedCount(0);
      setHasMore(true);
      setLoadFailed(false);
      return;
    }
    isInitialLoad.current = true;
    setIsLoading(true);
    setHasMore(true);
    setLoadFailed(false);
    setLoadedCount(0);
    setHasLoadedFirstPage(false);
    let cancelled = false;
    // Safety timeout: if the load doesn't complete in 8s, surface a retry.
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      setLoadFailed(true);
      setIsLoading(false);
    }, 8000);
    loadMessagesRef.current(contactId, 50, 0)
      .then(({ messages: fetched, hasMore: more }) => {
        if (cancelled) return;
        setHasMore(more);
        setLoadedCount(fetched.length);
        setHasLoadedFirstPage(true);
        // Two RAFs to ensure DOM (incl. images/audio placeholders) is laid out.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            bottomRef.current?.scrollIntoView({ behavior: 'auto' });
            isInitialLoad.current = false;
          });
        });
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (cancelled) return;
        window.clearTimeout(timeoutId);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [contactId, isReady]);

  // Resilience: if the parent context wipes the message cache for the
  // current contact (e.g. a silent refresh after a queue scope change) but
  // we already finished the initial load, refire it instead of waiting for
  // the user to leave/return to the route.
  useEffect(() => {
    if (!contactId) return;
    if (!isReady) return;
    if (isLoading) return;
    const bucket = messages[contactId];
    if (bucket && bucket.length > 0) return;
    // If the first page was never marked loaded (e.g. context was not
    // ready when the contact was first selected), force a fetch now that
    // the context is ready and the bucket is still empty.
    // If the first page WAS loaded but the bucket got wiped (silent
    // refresh, scope change resettle), also re-hydrate.
    // Bucket missing/empty — re-hydrate.
    let cancelled = false;
    setIsLoading(true);
    isInitialLoad.current = true;
    loadMessagesRef.current(contactId, 50, 0)
      .then(({ messages: fetched, hasMore: more }) => {
        if (cancelled) return;
        setHasMore(more);
        setLoadedCount(fetched.length);
        setHasLoadedFirstPage(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            bottomRef.current?.scrollIntoView({ behavior: 'auto' });
            isInitialLoad.current = false;
          });
        });
      })
      .catch(() => { if (!cancelled) setLoadFailed(true); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, messages[contactId], hasLoadedFirstPage, isReady]);

  // Auto-scroll to bottom on new messages (if near bottom)
  useEffect(() => {
    if (isInitialLoad.current || !scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [contactMessages.length]);

  // Load more messages with scroll position preservation
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    prevScrollHeight.current = el.scrollHeight;
    setIsLoadingMore(true);
    try {
      // Use the RAW server-side loaded count as the offset, not the filtered
      // timeline length — otherwise hidden notes / envelopes would shift the
      // page window and skip or duplicate older messages.
      const { messages: fetched, hasMore: more } = await loadMessagesRef.current(contactId, 50, loadedCount);
      setHasMore(more);
      setLoadedCount((c) => c + fetched.length);
      // Preserve scroll position after prepending older messages.
      // Two RAFs handle late layout (images / media placeholders).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (el) {
            const newScrollHeight = el.scrollHeight;
            el.scrollTop = newScrollHeight - prevScrollHeight.current;
          }
        });
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [contactId, loadedCount, hasMore, isLoadingMore]);

  // IntersectionObserver for infinite scroll (top sentinel).
  // Only attach AFTER the initial load completed and there are messages;
  // avoids accidental triggers on the empty placeholder list.
  // Use the scroll container itself as the observer root so the sentinel
  // is evaluated against the message viewport (not the page viewport).
  useEffect(() => {
    if (!topSentinelRef.current) return;
    if (!scrollContainerRef.current) return;
    if (isLoading) return;
    if (!hasLoadedFirstPage) return;
    if (contactMessages.length === 0) return;
    if (!hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting &&
          hasMore &&
          !isLoadingMore &&
          !isInitialLoad.current &&
          contactMessages.length > 0
        ) {
          handleLoadMore();
        }
      },
      {
        root: scrollContainerRef.current,
        threshold: 0.1,
        rootMargin: '200px 0px 0px 0px',
      }
    );
    observer.observe(topSentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading, hasLoadedFirstPage, contactMessages.length, handleLoadMore]);

  const handleRetry = useCallback(() => {
    setLoadFailed(false);
    setIsLoading(true);
    loadMessagesRef.current(contactId, 50, 0)
      .then(({ messages: fetched, hasMore: more }) => {
        setHasMore(more);
        setLoadedCount(fetched.length);
        setHasLoadedFirstPage(true);
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setIsLoading(false));
  }, [contactId]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  };

  // Merge messages and events into a unified timeline
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    for (const msg of contactMessages) {
      items.push({ kind: 'message', data: msg, ts: new Date(msg.timestamp).getTime() });
    }
    for (const evt of conversationHistory) {
      items.push({ kind: 'event', data: evt, ts: new Date(evt.created_at).getTime() });
    }
    items.sort((a, b) => a.ts - b.ts);
    return items;
  }, [contactMessages, conversationHistory]);

  // Group by date
  const groupedTimeline = useMemo(() => {
    const groups: Record<string, TimelineItem[]> = {};
    for (const item of timeline) {
      const dateKey = format(new Date(item.ts), 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    }
    return groups;
  }, [timeline]);

  // Reactions
  const visibleMessageIds = useMemo(
    () => contactMessages.map((m: ChatMessage) => m.id).filter(Boolean),
    [contactMessages]
  );
  const { reactionsByMsg } = useMessageReactions(visibleMessageIds);
  const contact = contacts.find((c: ChatContact) => c.id === contactId);

  const handleReact = useCallback(async (msg: ChatMessage, emoji: string) => {
    if (!contact) { toast.error('Contato não encontrado'); return; }
    // Resolve queue from current conversation first; fall back to contact channel_source or global selectedQueue
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const channelSource = (contact as any)?.channel_source as string | undefined;
    const queueId =
      selectedConversation?.queue_id ||
      (channelSource && uuidRe.test(channelSource) ? channelSource : undefined) ||
      selectedQueue?.id;
    if (!queueId) { toast.error('Conversa sem fila vinculada'); return; }
    try {
      await sendReaction({
        message_id: msg.id,
        external_message_id: msg.message_id,
        emoji,
        queue_id: queueId,
        contact_phone: contact.phone,
        reactor: String(user?.id || 'me'),
        from_me: true,
      });
    } catch (e) { console.error(e); toast.error('Erro ao reagir'); }
  }, [selectedQueue, selectedConversation?.queue_id, contact, user?.id]);

  const handleForward = useCallback((msg: ChatMessage) => setForwardMessage(msg), []);

  const formatDateHeader = (dateKey: string) => {
    // Parse as local date — new Date("yyyy-MM-dd") is treated as UTC midnight,
    // which shifts to the previous day in UTC-3 (Brazil). Using the constructor
    // with numeric parts creates the date in local time instead.
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (isSameDay(date, today)) return 'Hoje';
    if (isSameDay(date, yesterday)) return 'Ontem';
    return format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  return (
    <div className="flex-1 relative flex flex-col overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4"
        onScroll={handleScroll}
      >
        <div className="space-y-4">
          {/* Top sentinel for IntersectionObserver */}
          <div ref={topSentinelRef} className="h-1" />

          {/* Loading more indicator */}
          {isLoadingMore && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Manual fallback to load older messages (always works even when
              the IntersectionObserver does not fire — e.g. very tall first
              page or unusual scroll containers). */}
          {!isLoadingMore && hasMore && hasLoadedFirstPage && contactMessages.length > 0 && (
            <div className="flex justify-center py-2">
              <Button variant="ghost" size="sm" onClick={handleLoadMore}>
                Carregar mensagens anteriores
              </Button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && contactMessages.length === 0 && (
            <div className="space-y-3 py-2" aria-label="Carregando mensagens">
              {[
                { side: 'left',  w: 'w-3/5' },
                { side: 'right', w: 'w-2/5' },
                { side: 'left',  w: 'w-1/2' },
                { side: 'right', w: 'w-3/4' },
                { side: 'left',  w: 'w-2/5' },
              ].map((s, i) => (
                <div key={i} className={`flex ${s.side === 'right' ? 'justify-end' : 'justify-start'}`}>
                  <Skeleton className={`h-10 ${s.w} rounded-2xl`} />
                </div>
              ))}
            </div>
          )}

          {/* Failed-load retry */}
          {loadFailed && contactMessages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-3">
              <p className="font-medium">Não foi possível carregar as mensagens</p>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          )}

          {/* Timeline grouped by date */}
          {Object.entries(groupedTimeline).map(([dateKey, items]) => (
            <div key={dateKey}>
              <div className="flex items-center justify-center my-4">
                <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                  {formatDateHeader(dateKey)}
                </div>
              </div>
              <div className="space-y-2">
                {items.map((item) => {
                  if (item.kind === 'event') {
                    return <ConversationEvent key={`evt-${item.data.id}`} entry={item.data} />;
                  }
                  return (
                    <MessageBubble
                      key={item.data.id}
                      message={item.data}
                      reactions={reactionsByMsg[item.data.id]}
                      onReact={handleReact}
                      onForward={handleForward}
                      onReply={onReply}
                      onDownloadMedia={downloadMedia}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Empty state */}
          {!isLoading && contactMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <p className="font-medium">Nenhuma mensagem</p>
              <p className="text-sm mt-1">Comece uma conversa enviando uma mensagem</p>
            </div>
          )}

          {/* Bottom anchor */}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-4 right-4 rounded-full shadow-lg"
          onClick={scrollToBottom}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}

      <ForwardDialog
        open={!!forwardMessage}
        onOpenChange={(o) => !o && setForwardMessage(null)}
        message={forwardMessage}
      />
    </div>
  );
}
