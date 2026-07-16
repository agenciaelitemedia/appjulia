import { useEffect, useState } from 'react';
import { WhatsAppDataProvider, useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { ChatContainer } from '@/components/chat';
import { ChatCommandPalette } from '@/components/chat/ChatCommandPalette';
import { supabase } from '@/integrations/supabase/client';
import { useUserQueueAccess } from '@/hooks/useUserQueueAccess';
import { toast } from 'sonner';
import {
  readPendingSelection,
  clearPendingSelection,
  conversationStatusToPendingTab,
} from '@/lib/chat/pendingSelection';

function ChatPageContent() {
  const { selectContact, isReady, contacts, selectedQueue, setSelectedQueue, setConversationStatusFilter, setSearchQuery } = useWhatsAppData();
  const { data: queueAccess } = useUserQueueAccess();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Consumo sequencial e unificado dos itens `chat_pending_*` gravados pelo
  // painel lateral do CRM. Primeiro hidrata a fila (se necessário) e só
  // depois aplica o contato — evita race entre os dois efeitos.
  useEffect(() => {
    if (!isReady) return;
    const pending = readPendingSelection();
    if (!pending) return;

    let cancelled = false;

    // Etapa 1: aplicar fila se ainda não estiver selecionada
    if (pending.queueId && selectedQueue?.id !== pending.queueId) {
      // Valida acesso antes de buscar
      const access = queueAccess;
      if (access && access.queue_access === 'specific' && !access.queue_ids.includes(pending.queueId)) {
        clearPendingSelection();
        toast.warning('Você não tem acesso à fila desta conversa.');
        return;
      }
      (async () => {
        const { data } = await supabase
          .from('queues')
          .select('id, name, channel_type, hub, evo_url, evo_apikey, evo_instance, is_deleted')
          .eq('id', pending.queueId!)
          .maybeSingle();
        if (cancelled) return;
        if (!data || (data as any).is_deleted === true) {
          clearPendingSelection();
          toast.warning('Conversa indisponível: fila não encontrada.');
          return;
        }
        setSelectedQueue({
          id: data.id,
          name: (data as any).name ?? '',
          channel_type: ((data as any).channel_type as string) ?? '',
          hub: ((data as any).hub as string | null) ?? null,
          evo_url: ((data as any).evo_url as string | null) ?? null,
          evo_apikey: ((data as any).evo_apikey as string | null) ?? null,
          evo_instance: ((data as any).evo_instance as string | null) ?? null,
        });
        // Próximo tick: o efeito roda de novo já com a fila aplicada
      })();
      return () => { cancelled = true; };
    }

    // Etapa 2: contato. Não bloqueamos por `contacts.length === 0`:
    // temos o UUID do contato e o `selectContact` faz hidratação por ID,
    // então a seleção funciona mesmo se a lista visível ainda não trouxe
    // este contato (ex.: aba diferente, filtro estreito, paginação).
    clearPendingSelection();
    (async () => {
      let nextTab = pending.tab;
      if (pending.conversationId) {
        try {
          const { data } = await supabase
            .from('chat_conversations')
            .select('status, assigned_to')
            .eq('id', pending.conversationId)
            .maybeSingle();
          nextTab = conversationStatusToPendingTab(
            (data as any)?.status,
            (data as any)?.assigned_to,
          ) ?? nextTab;
        } catch {
          /* mantém a aba gravada no pending */
        }
      }
      if (cancelled) return;
      if (nextTab) setConversationStatusFilter(nextTab);
      setSearchQuery(pending.search ?? '');
      selectContact(pending.contactId);
    })();
    return () => { cancelled = true; };
  }, [isReady, contacts.length, selectedQueue?.id, setSelectedQueue, selectContact, setConversationStatusFilter, setSearchQuery, queueAccess]);

  // Limpa pending órfão ao sair da aba/janela
  useEffect(() => {
    const handler = () => clearPendingSelection();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

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
