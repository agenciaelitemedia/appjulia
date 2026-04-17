import { useEffect, useState } from 'react';
import { WhatsAppDataProvider, useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { ChatContainer } from '@/components/chat';
import { ChatCommandPalette } from '@/components/chat/ChatCommandPalette';

function ChatPageContent() {
  const { loadContacts } = useWhatsAppData();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

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
    <div className="h-[calc(100vh-4rem)] w-full overflow-hidden -mx-4 sm:-mx-6 -mb-4 sm:-mb-6">
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
