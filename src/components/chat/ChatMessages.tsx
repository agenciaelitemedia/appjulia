import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown } from 'lucide-react';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { MessageBubble } from './MessageBubble';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatMessagesProps {
  contactId: string;
}

export function ChatMessages({ contactId }: ChatMessagesProps) {
  const { messages, loadMessages, markAsRead } = useWhatsAppData();
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  
  const contactMessages = messages[contactId] || [];

  // Initial load
  useEffect(() => {
    isInitialLoad.current = true;
    setIsLoading(true);
    loadMessages(contactId, 50, 0)
      .then(({ hasMore: more }) => {
        setHasMore(more);
        // Scroll to bottom on initial load
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'auto' });
          isInitialLoad.current = false;
        }, 100);
      })
      .finally(() => setIsLoading(false));
    
    // Mark as read
    markAsRead(contactId);
  }, [contactId, loadMessages, markAsRead]);

  // Load more messages
  const handleLoadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    
    setIsLoading(true);
    try {
      const { hasMore: more } = await loadMessages(
        contactId, 
        50, 
        contactMessages.length
      );
      setHasMore(more);
    } finally {
      setIsLoading(false);
    }
  }, [contactId, contactMessages.length, hasMore, isLoading, loadMessages]);

  // Scroll to bottom
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle scroll events
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    setShowScrollButton(!isNearBottom);
    
    // Load more when near top
    if (target.scrollTop < 100 && hasMore && !isLoading) {
      handleLoadMore();
    }
  };

  // Group messages by date
  const groupedMessages = contactMessages.reduce((groups, msg) => {
    const date = new Date(msg.timestamp);
    const dateKey = format(date, 'yyyy-MM-dd');
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(msg);
    return groups;
  }, {} as Record<string, typeof contactMessages>);

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
      <ScrollArea 
        ref={scrollRef}
        className="flex-1 p-4"
        onScrollCapture={handleScroll}
      >
        <div className="space-y-4">
          {/* Load more button */}
          {hasMore && (
            <div className="flex justify-center py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {isLoading ? 'Carregando...' : 'Carregar mais mensagens'}
              </Button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && contactMessages.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Messages grouped by date */}
          {Object.entries(groupedMessages).map(([dateKey, msgs]) => (
            <div key={dateKey}>
              {/* Date header */}
              <div className="flex items-center justify-center my-4">
                <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                  {formatDateHeader(dateKey)}
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-2">
                {msgs.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
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
      </ScrollArea>

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
