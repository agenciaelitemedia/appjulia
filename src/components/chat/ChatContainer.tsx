import React, { useState, useEffect, useRef } from 'react';
import { ChatList } from './ChatList';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { ContactDetailPanel } from './ContactDetailPanel';
import { ChatTicketSidePanel } from './ChatTicketSidePanel';
import { ChatTicketDetailSidePanel } from './ChatTicketDetailSidePanel';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { MessageCircle, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { ChatMessage } from '@/types/chat';
import type { ChatContact } from '@/types/chat';

const ChatListFallback = () => (
  <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-muted-foreground">
    <AlertCircle className="h-8 w-8 text-destructive" />
    <p className="text-sm text-center">Erro ao carregar a lista de conversas.</p>
    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
      <RefreshCw className="h-4 w-4 mr-2" /> Recarregar
    </Button>
  </div>
);

const ChatMessagesFallback = () => (
  <div className="flex flex-col items-center justify-center flex-1 gap-3 p-6 text-muted-foreground">
    <AlertCircle className="h-8 w-8 text-destructive" />
    <p className="text-sm text-center">Erro ao carregar as mensagens.</p>
    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
      <RefreshCw className="h-4 w-4 mr-2" /> Recarregar
    </Button>
  </div>
);

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
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [ticketPanel, setTicketPanel] = useState<
    | { mode: 'create'; contact: ChatContact; conversation: any }
    | { mode: 'detail'; contact: ChatContact; ticketId: string }
    | null
  >(null);

  // Fecha o painel de ticket ao trocar para outra conversa (ignora abertura inicial)
  const prevContactIdRef = useRef<string | null | undefined>(selectedContactId);
  useEffect(() => {
    const prev = prevContactIdRef.current;
    if (prev && prev !== selectedContactId) {
      setTicketPanel(null);
    }
    prevContactIdRef.current = selectedContactId;
  }, [selectedContactId]);


  return (
    <div className={cn('flex h-full w-full bg-background min-w-0 overflow-hidden', className)}>
      {/* Contact list sidebar */}
      <div className={cn(
        'w-full lg:w-[352px] xl:w-[400px] 2xl:w-[448px] lg:flex-shrink-0 flex-shrink-0 border-r min-w-0 overflow-hidden',
        (selectedContact || selectedContactId) && 'hidden lg:flex lg:flex-col'
      )}>
        <ErrorBoundary fallback={<ChatListFallback />}>
          <ChatList
            onOpenTicketPanel={(contact, mode, ticketId, conversation) => {
              // Atualiza o ref ANTES de mudar contato para que o effect não feche o painel recém aberto
              prevContactIdRef.current = contact.id;
              selectContact(contact.id);
              if (mode === 'detail' && ticketId) {
                setTicketPanel({ mode: 'detail', contact, ticketId });
              } else {
                setTicketPanel({ mode: 'create', contact, conversation });
              }
            }}
          />
        </ErrorBoundary>
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
            <ErrorBoundary fallback={<ChatMessagesFallback />}>
              <ChatMessages
                contactId={selectedContactId!}
                onReply={setReplyToMessage}
                onEdit={(m) => { setReplyToMessage(null); setEditingMessage(m); }}
              />
            </ErrorBoundary>
            <ChatInput
              contactId={selectedContactId!}
              replyToMessage={replyToMessage}
              onCancelReply={() => setReplyToMessage(null)}
              editingMessage={editingMessage}
              onCancelEdit={() => setEditingMessage(null)}
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
            <VisuallyHidden>
              <SheetTitle>Detalhes do contato</SheetTitle>
              <SheetDescription>Informações e ações do contato selecionado</SheetDescription>
            </VisuallyHidden>
            <ContactDetailPanel
              contact={selectedContact}
              onClose={() => setShowDetailPanel(false)}
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Painéis de ticket abertos a partir do menu de contexto da lista */}
      {ticketPanel?.mode === 'create' && (
        <ChatTicketSidePanel
          open
          onClose={() => setTicketPanel(null)}
          contact={ticketPanel.contact}
          conversation={ticketPanel.conversation ?? null}
        />
      )}
      {ticketPanel?.mode === 'detail' && (
        <ChatTicketDetailSidePanel
          open
          onClose={() => setTicketPanel(null)}
          ticketId={ticketPanel.ticketId}
        />
      )}
    </div>
  );
}
