import React, { useState } from 'react';
import { ChatList } from './ChatList';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { ContactDetailPanel } from './ContactDetailPanel';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { MessageCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';

interface ChatContainerProps {
  className?: string;
}

export function ChatContainer({ className }: ChatContainerProps) {
  const {
    selectedContact,
    selectContact,
    selectedContactId,
    showDetailPanel,
    setShowDetailPanel,
    isHydratingContact,
    contactHydrationError,
    retryHydrateSelectedContact,
  } = useWhatsAppData();
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);

  return (
    <div className={cn('flex h-full w-full bg-background min-w-0 overflow-hidden', className)}>
      {/* Contact list sidebar */}
      <div className={cn(
        'w-full lg:w-[352px] xl:w-[400px] 2xl:w-[448px] lg:flex-shrink-0 flex-shrink-0 border-r min-w-0 overflow-hidden',
        (selectedContact || selectedContactId) && 'hidden lg:flex lg:flex-col'
      )}>
        <ChatList />
      </div>

      {/* Chat area */}
      <div className={cn(
        'flex-1 flex flex-col min-w-0',
        !selectedContact && !selectedContactId && 'hidden lg:flex'
      )}>
        {selectedContact ? (
          <>
            <ChatHeader 
              contact={selectedContact} 
              onClose={() => selectContact(null)}
              onShowDetails={() => setShowDetailPanel(!showDetailPanel)}
            />
            <ChatMessages contactId={selectedContactId!} onReply={setReplyToMessage} />
            <ChatInput
              contactId={selectedContactId!}
              replyToMessage={replyToMessage}
              onCancelReply={() => setReplyToMessage(null)}
            />
          </>
        ) : selectedContactId && contactHydrationError ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="bg-destructive/10 p-6 rounded-full mb-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <h3 className="text-lg font-medium text-foreground">Não foi possível abrir a conversa</h3>
            <p className="text-sm mt-1 text-muted-foreground max-w-sm">{contactHydrationError}</p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => selectContact(null)}>Voltar</Button>
              <Button onClick={retryHydrateSelectedContact}>Tentar novamente</Button>
            </div>
          </div>
        ) : selectedContactId && (isHydratingContact || !selectedContact) ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p className="text-sm">Carregando conversa…</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <div className="bg-muted/50 p-6 rounded-full mb-4">
              <MessageCircle className="h-12 w-12" />
            </div>
            <h3 className="text-lg font-medium text-foreground">Selecione uma conversa</h3>
            <p className="text-sm mt-1">Escolha um contato para ver as mensagens</p>
          </div>
        )}
      </div>

      {/* Contact detail panel - overlay sheet */}
      {selectedContact && (
        <Sheet open={showDetailPanel} onOpenChange={setShowDetailPanel}>
          <SheetContent side="right" className="w-[456px] sm:w-[504px] sm:max-w-[504px] p-0 overflow-y-auto">
            <ContactDetailPanel
              contact={selectedContact}
              onClose={() => setShowDetailPanel(false)}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
