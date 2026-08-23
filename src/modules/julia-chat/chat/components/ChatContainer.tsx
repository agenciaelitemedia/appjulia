import React, { useState, useEffect, useRef } from 'react';
import { ChatList } from './ChatList';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { ChatRightBar } from './ChatRightBar';
import { ChatTicketSidePanel } from './ChatTicketSidePanel';
import { ChatTicketDetailSidePanel } from './ChatTicketDetailSidePanel';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useWhatsAppData } from '@/modules/julia-chat/chat/contexts/WhatsAppDataContext';
import { MessageCircle, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { ChatMessage } from '@/types/chat';
import type { ChatContact } from '@/types/chat';
import { MascoteLoader } from "@/components/ui/mascote-loader";

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

/** true quando a viewport é menor que o breakpoint `lg` (1024px) do Tailwind */
function useIsBelowLg() {
  const [below, setBelow] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < 1024,
  );
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const onChange = () => setBelow(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return below;
}

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
    rightBarTab,
    setRightBarTab,
    isHydratingContact,
    contactHydrationError,
    retryHydrateSelectedContact,
  } = useWhatsAppData();
  const isBelowLg = useIsBelowLg();
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
        'w-full lg:w-[282px] xl:w-[330px] 2xl:w-[378px] lg:flex-shrink-0 flex-shrink-0 border-r min-w-0 overflow-hidden',
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
              onShowDetails={() => {
                if (showDetailPanel && rightBarTab === 'contact') {
                  setShowDetailPanel(false);
                } else {
                  setRightBarTab('contact');
                  setShowDetailPanel(true);
                }
              }}
              onShowCrm={() => {
                setRightBarTab('crm');
                setShowDetailPanel(true);
              }}
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
            <MascoteLoader size="sm" />
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

      {/* Right-bar fixa (desktop) */}
      {selectedContact && showDetailPanel && (
        <div className="hidden lg:flex lg:flex-shrink-0 w-[360px] xl:w-[400px] min-w-0">
          <ErrorBoundary fallback={<div className="p-6 text-sm text-muted-foreground">Erro ao carregar o painel.</div>}>
            <ChatRightBar
              contact={selectedContact}
              onClose={() => setShowDetailPanel(false)}
              className="w-full"
            />
          </ErrorBoundary>
        </div>
      )}

      {/* Right-bar em overlay (mobile/tablet) — não montado no desktop para
          que a cortina do Sheet nunca cubra a conversa */}
      {selectedContact && isBelowLg && (
        <Sheet open={showDetailPanel} onOpenChange={setShowDetailPanel}>
          <SheetContent side="right" className="w-full sm:w-[440px] sm:max-w-[440px] p-0 lg:hidden">
            <VisuallyHidden>
              <SheetTitle>Detalhes da conversa</SheetTitle>
              <SheetDescription>Informações do contato e card do CRM</SheetDescription>
            </VisuallyHidden>
            <ChatRightBar
              contact={selectedContact}
              onClose={() => setShowDetailPanel(false)}
              className="h-full border-l-0"
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
