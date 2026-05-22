import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useChatClientSettings } from '@/hooks/useChatClientSettings';

interface ChatMessagesProps {
  contactId: string;
  onReply?: (message: ChatMessage) => void;
  onEdit?: (message: ChatMessage) => void;
}

type TimelineItem =
  | { kind: 'message'; data: ChatMessage; ts: number }
  | { kind: 'event'; data: ConversationHistoryEntry; ts: number };

export function ChatMessages({ contactId, onReply, onEdit }: ChatMessagesProps) {
  const { messages, loadMessages, conversationHistory, loadConversationHistory, selectedConversation, downloadMedia, selectedQueue, contacts } = useWhatsAppData();
  const { settings: chatClientSettings } = useChatClientSettings();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const prevScrollHeight = useRef(0);

  // Mutable refs to avoid stale closures in stable callbacks
  const hasMoreRef = useRef(hasMore);
  const isLoadingMoreRef = useRef(isLoadingMore);
  const loadedMessagesLengthRef = useRef(0);
  
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

  // Keep refs in sync with state
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { isLoadingMoreRef.current = isLoadingMore; }, [isLoadingMore]);
  useEffect(() => { loadedMessagesLengthRef.current = allContactMessages.length; }, [allContactMessages.length]);

  // Load conversation history when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      loadConversationHistory(selectedConversation.id);
    }
  }, [selectedConversation?.id, loadConversationHistory]);

  // Realtime: refresh history when new events (resolved/assumed/reopened/notes)
  // are written for the current conversation, so badges appear instantly.
  useEffect(() => {
    if (!selectedConversation?.id) return;
    const convId = selectedConversation.id;
    const channel = supabase
      .channel(`conv-history-${convId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversation_history',
          filter: `conversation_id=eq.${convId}`,
        },
        () => {
          loadConversationHistory(convId);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation?.id, loadConversationHistory]);

  // Initial load
  useEffect(() => {
    isInitialLoad.current = true;
    if (!contactId) {
      setIsLoading(false);
      setHasMore(true);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setHasMore(true);
    setLoadError(null);

    // Attempt initial load with up to 2 automatic retries (exponential-ish backoff).
    const MAX_ATTEMPTS = 3;
    const attempt = async (n: number): Promise<void> => {
      try {
        const { hasMore: more } = await loadMessages(contactId, 50, 0);
        if (cancelled) return;
        setHasMore(more);
        setLoadError(null);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            bottomRef.current?.scrollIntoView({ behavior: 'auto' });
            isInitialLoad.current = false;
          });
        });
      } catch (err) {
        if (cancelled) return;
        if (n < MAX_ATTEMPTS) {
          const delay = 600 * n;
          await new Promise((r) => setTimeout(r, delay));
          if (cancelled) return;
          return attempt(n + 1);
        }
        console.error('[ChatMessages] failed to load messages:', err);
        setLoadError(
          err instanceof Error ? err.message : 'Não foi possível carregar as mensagens.'
        );
      } finally {
        if (!cancelled && n >= MAX_ATTEMPTS) setIsLoading(false);
      }
    };

    attempt(1).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [contactId, loadMessages, retryAttempt]);

  const handleManualRetry = useCallback(() => {
    setRetryAttempt((n) => n + 1);
  }, []);

  // Auto-scroll to bottom on new messages (if near bottom)
  useEffect(() => {
    if (isInitialLoad.current || !scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) {
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
    }
  }, [contactMessages.length]);

  // Load more messages with scroll position preservation.
  // Deps are intentionally minimal (contactId, loadMessages) — hasMore/isLoadingMore/length
  // are read from refs to avoid recreating this callback on every new message, which would
  // otherwise tear down and re-attach the IntersectionObserver constantly.
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMoreRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    prevScrollHeight.current = el.scrollHeight;
    setIsLoadingMore(true);
    try {
      const nextOffset = loadedMessagesLengthRef.current;
      const { hasMore: more } = await loadMessages(contactId, 50, nextOffset);
      setHasMore(more);
      requestAnimationFrame(() => {
        if (el) {
          el.scrollTop = el.scrollHeight - prevScrollHeight.current;
        }
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [contactId, loadMessages]);

  // Cold-open fallback: if the first page still leaves the top sentinel visible,
  // ask for older messages immediately instead of waiting for a new intersection
  // event that may never happen on the first render cycle.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || isLoading || isInitialLoad.current || !hasMore) return;
    if (el.scrollTop <= 120) {
      handleLoadMore();
    }
  }, [contactMessages.length, hasMore, isLoading, handleLoadMore]);

  // IntersectionObserver for infinite scroll (top sentinel).
  // Important: use the chat scroll container as the observer root; otherwise
  // the first cold load can miss intersections because only the inner panel
  // scrolls, not the browser viewport.
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isInitialLoad.current) {
          handleLoadMore();
        }
      },
      { root, threshold: 0, rootMargin: '120px 0px 0px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScroll = useCallback(() => {
    if (scrollThrottleRef.current) return;
    scrollThrottleRef.current = setTimeout(() => {
      scrollThrottleRef.current = null;
      const el = scrollContainerRef.current;
      if (!el) return;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      setShowScrollButton(!isNearBottom);
      if (!isInitialLoad.current && el.scrollTop <= 120) {
        handleLoadMore();
      }
    }, 80);
  }, [handleLoadMore]);

  // Merge messages and events into a unified timeline grouped by date.
  // Both arrays are already ordered chronologically (loadMessages returns DESC→reversed,
  // conversationHistory is ordered ASC), so we merge with a two-pointer O(n+m) pass
  // instead of concat+sort O((n+m) log(n+m)) — avoids full re-sort on every new message.
  const groupedTimeline = useMemo(() => {
    const msgItems: TimelineItem[] = contactMessages.map(msg => ({
      kind: 'message' as const,
      data: msg,
      ts: new Date(msg.timestamp).getTime(),
    }));
    const evtItems: TimelineItem[] = conversationHistory.map(evt => ({
      kind: 'event' as const,
      data: evt,
      ts: new Date(evt.created_at).getTime(),
    }));

    // Two-pointer merge (both arrays already sorted ASC)
    const merged: TimelineItem[] = [];
    let i = 0, j = 0;
    while (i < msgItems.length && j < evtItems.length) {
      if (msgItems[i].ts <= evtItems[j].ts) merged.push(msgItems[i++]);
      else merged.push(evtItems[j++]);
    }
    while (i < msgItems.length) merged.push(msgItems[i++]);
    while (j < evtItems.length) merged.push(evtItems[j++]);

    const groups: Record<string, TimelineItem[]> = {};
    for (const item of merged) {
      const dateKey = format(new Date(item.ts), 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    }
    return groups;
  }, [contactMessages, conversationHistory]);

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

          {/* Manual "Load more" button — fallback when auto-load via IntersectionObserver
              doesn't trigger (e.g., first cold load with not enough content to scroll). */}
          {!isLoading && hasMore && contactMessages.length > 0 && (
            <div className="flex justify-center py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="rounded-full text-xs gap-2"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Carregando…
                  </>
                ) : (
                  'Carregar mais mensagens'
                )}
              </Button>
            </div>
          )}

          {isLoadingMore && contactMessages.length === 0 && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Loading state */}
          {isLoading && contactMessages.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error state with retry */}
          {!isLoading && loadError && contactMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-3">
              <p className="text-sm">{loadError}</p>
              <Button size="sm" variant="outline" onClick={handleManualRetry} className="rounded-full">
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
                    if (!chatClientSettings.events_enabled) return null;
                    if (chatClientSettings.event_visibility?.[item.data.action] === false) return null;
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
                      onEdit={onEdit}
                      onDownloadMedia={downloadMedia}
                      isGroup={contacts.find(c => c.id === contactId)?.is_group}
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
