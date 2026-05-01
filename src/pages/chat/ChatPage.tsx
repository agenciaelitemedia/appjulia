import { useEffect, useState } from 'react';
import { WhatsAppDataProvider, useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { ChatContainer } from '@/components/chat';
import { ChatCommandPalette } from '@/components/chat/ChatCommandPalette';

function ChatPageContent() {
  const { selectContact, isReady, contacts } = useWhatsAppData();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Process deep-link pending contact once bootstrap is ready and contacts are loaded
  useEffect(() => {
    if (!isReady || contacts.length === 0) return;
    const pending = sessionStorage.getItem('chat_pending_contact_id');
    if (pending) {
      sessionStorage.removeItem('chat_pending_contact_id');
      selectContact(pending);
    }
  }, [isReady, contacts.length, selectContact]);

  // Cmd+K / Ctrl+K para abrir Command Palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="h-[calc(100dvh-4rem)] w-[calc(100%+2rem)] lg:w-[calc(100%+3rem)] overflow-hidden -m-4 lg:-m-6">
      <ChatContainer className="h-full w-full" />
      <ChatCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
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
