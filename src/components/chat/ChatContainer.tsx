import React from 'react';
import { ChatList } from './ChatList';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatContainerProps {
  className?: string;
}

export function ChatContainer({ className }: ChatContainerProps) {
  const { selectedContact, selectContact, selectedContactId } = useWhatsAppData();

  return (
    <div className={cn('flex h-full bg-background', className)}>
      {/* Contact list - always visible on desktop, hidden on mobile when chat is open */}
      <div className={cn(
        'w-full lg:w-80 lg:min-w-80 border-r flex-shrink-0',
        selectedContact && 'hidden lg:block'
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
    </div>
  );
}
