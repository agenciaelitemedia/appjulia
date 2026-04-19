import React from 'react';
import { ChatList } from './ChatList';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { ContactDetailPanel } from './ContactDetailPanel';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatContainerProps {
  className?: string;
}

export function ChatContainer({ className }: ChatContainerProps) {
  const { selectedContact, selectContact, selectedContactId, showDetailPanel, setShowDetailPanel } = useWhatsAppData();

  return (
    <div className={cn('flex h-full w-full bg-background min-w-0 overflow-hidden', className)}>
      {/* Contact list sidebar */}
      <div className={cn(
        'w-full lg:w-[440px] xl:w-[500px] 2xl:w-[560px] lg:flex-shrink-0 flex-shrink-0 border-r min-w-0 overflow-hidden',
        selectedContact && 'hidden lg:flex lg:flex-col'
      )}>
        <ChatList />
      </div>

      {/* Chat area */}
      <div className={cn(
        'flex-1 flex flex-col min-w-0',
        !selectedContact && 'hidden lg:flex'
      )}>
        {selectedContact ? (
          <>
            <ChatHeader 
              contact={selectedContact} 
              onClose={() => selectContact(null)}
              onShowDetails={() => setShowDetailPanel(!showDetailPanel)}
            />
            <ChatMessages contactId={selectedContactId!} />
            <ChatInput contactId={selectedContactId!} />
          </>
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

      {/* Contact detail panel - right side */}
      {selectedContact && showDetailPanel && (
        <div className="hidden lg:flex w-80 flex-shrink-0 border-l">
          <ContactDetailPanel 
            contact={selectedContact}
            onClose={() => setShowDetailPanel(false)}
          />
        </div>
      )}
    </div>
  );
}
