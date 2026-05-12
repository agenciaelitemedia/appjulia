import { useEffect, useState } from 'react';
import { WhatsAppDataProvider, useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { ChatContainer } from '@/components/chat';
import { ChatCommandPalette } from '@/components/chat/ChatCommandPalette';
import { supabase } from '@/integrations/supabase/client';

function ChatPageContent() {
  const { selectContact, isReady, contacts, selectedQueue, setSelectedQueue } = useWhatsAppData();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Process pending queue deep-link as soon as bootstrap is ready. Hydrates
  // the queue row from `queues` and applies it via setSelectedQueue so
  // loadContacts/loadConversations target the correct queue before the
  // contact selection runs below.
  useEffect(() => {
    if (!isReady) return;
    const pendingQueueId = sessionStorage.getItem('chat_pending_queue_id');
    if (!pendingQueueId) return;
    if (selectedQueue?.id === pendingQueueId) {
      sessionStorage.removeItem('chat_pending_queue_id');
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('queues')
        .select('id, name, channel_type, hub, evo_url, evo_apikey, evo_instance')
        .eq('id', pendingQueueId)
        .maybeSingle();
      if (cancelled || !data) return;
      sessionStorage.removeItem('chat_pending_queue_id');
      setSelectedQueue({
        id: data.id,
        name: (data as any).name ?? '',
        channel_type: ((data as any).channel_type as string) ?? '',
        hub: ((data as any).hub as string | null) ?? null,
        evo_url: ((data as any).evo_url as string | null) ?? null,
        evo_apikey: ((data as any).evo_apikey as string | null) ?? null,
        evo_instance: ((data as any).evo_instance as string | null) ?? null,
      });
    })();
    return () => { cancelled = true; };
  }, [isReady, selectedQueue?.id, setSelectedQueue]);

  // Process deep-link pending contact once bootstrap is ready and contacts are loaded
  useEffect(() => {
    if (!isReady || contacts.length === 0) return;
    const pending = sessionStorage.getItem('chat_pending_contact_id');
    if (pending) {
      sessionStorage.removeItem('chat_pending_contact_id');
      sessionStorage.removeItem('chat_pending_conversation_id');
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
