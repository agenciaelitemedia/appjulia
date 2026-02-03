import React, { useEffect } from 'react';
import { WhatsAppDataProvider, useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { ChatContainer } from '@/components/chat';

function ChatPageContent() {
  const { loadContacts } = useWhatsAppData();

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  return (
    <div className="h-[calc(100vh-4rem)] -m-4 sm:-m-6">
      <ChatContainer className="h-full" />
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
