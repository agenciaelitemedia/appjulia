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
import type { ChatMessage } from '@/types/chat';
import type { ConversationHistoryEntry } from '@/types/conversation';

interface ChatMessagesProps {
  contactId: string;
}

type TimelineItem =
  | { kind: 'message'; data: any; ts: number }
  | { kind: 'event'; data: ConversationHistoryEntry; ts: number };

export function ChatMessages({ contactId }: ChatMessagesProps) {
  const ctx: any = useWhatsAppData();
  const { messages, loadMessages, markAsRead, conversationHistory, loadConversationHistory, selectedConversation } = ctx;
  const selectedQueue = ctx.selectedQueue;
  const contacts = ctx.contacts;
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const prevScrollHeight = useRef(0);
  
  const contactMessages = messages[contactId] || [];

  // Load conversation history when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      loadConversationHistory(selectedConversation.id);
    }
  }, [selectedConversation?.id, loadConversationHistory]);

  // Initial load
  useEffect(() => {
    isInitialLoad.current = true;
    setIsLoading(true);
    setHasMore(true);
    loadMessages(contactId, 50, 0)
      .then(({ hasMore: more }) => {
        setHasMore(more);
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'auto' });
          isInitialLoad.current = false;
        }, 150);
      })
      .finally(() => setIsLoading(false));
    
    markAsRead(contactId);
  }, [contactId, loadMessages, markAsRead]);

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
      const { hasMore: more } = await loadMessages(contactId, 50, contactMessages.length);
      setHasMore(more);
      // Preserve scroll position after prepending older messages
      requestAnimationFrame(() => {
        if (el) {
          const newScrollHeight = el.scrollHeight;
          el.scrollTop = newScrollHeight - prevScrollHeight.current;
        }
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [contactId, contactMessages.length, hasMore, isLoadingMore, loadMessages]);

  // IntersectionObserver for infinite scroll (top sentinel)
  useEffect(() => {
    if (!topSentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingMore && !isInitialLoad.current) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(topSentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, handleLoadMore]);

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
    () => contactMessages.map((m: any) => m.id).filter(Boolean),
    [contactMessages]
  );
  const { reactionsByMsg } = useMessageReactions(visibleMessageIds);
  const contact = contacts.find((c: any) => c.id === contactId);

  const handleReact = useCallback(async (msg: ChatMessage, emoji: string) => {
    if (!selectedQueue || !contact) { toast.error('Selecione uma fila para reagir'); return; }
    try {
      await sendReaction({
        message_id: msg.id,
        external_message_id: msg.message_id,
        emoji,
        queue_id: selectedQueue.id,
        contact_phone: contact.phone,
        reactor: String(user?.id || 'me'),
        from_me: true,
      });
    } catch (e) { console.error(e); toast.error('Erro ao reagir'); }
  }, [selectedQueue, contact, user?.id]);

  const handleForward = useCallback((msg: ChatMessage) => setForwardMessage(msg), []);

  const formatDateHeader = (dateKey: string) => {
    const date = new Date(dateKey);
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

          {/* Loading state */}
          {isLoading && contactMessages.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                  return <MessageBubble key={item.data.id} message={item.data} />;
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
    </div>
  );
}
