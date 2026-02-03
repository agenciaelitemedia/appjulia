import React, { useEffect } from 'react';
import { WhatsAppDataProvider, useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { ChatContainer } from '@/components/chat';

function ChatPageContent() {
  const { loadContacts } = useWhatsAppData();

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  return (
    <div className="h-[calc(100vh-4rem)] w-full overflow-hidden -mx-4 sm:-mx-6 -mb-4 sm:-mb-6">
      <ChatContainer className="h-full w-full" />
    </div>
  );
}

export default function ChatPage() {
  return (
    <WhatsAppDataProvider>
      <ChatPageContent />
    </WhatsAppDataProvider>
  );
}
