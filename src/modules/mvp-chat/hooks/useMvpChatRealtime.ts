import { useEffect } from 'react';
import { supabase } from '../extend/db';

interface Handlers {
  /** Mensagem nova em uma conversa já visível (ou não). */
  onMessage: (payload: any) => void;
  /** Conversa criada/atualizada. */
  onConversation: (payload: any, eventType: 'INSERT' | 'UPDATE') => void;
  /** Contato atualizado (prévia, não lidas, nome). */
  onContact: (payload: any) => void;
}

/**
 * Um único canal Realtime para o feed do MVP. Criado no mount e removido no
 * unmount — nada de canal por linha.
 */
export function useMvpChatRealtime(clientId: string | null, handlers: Handlers) {
  useEffect(() => {
    if (!clientId) return;

    const channel = supabase
      .channel(`mvp-chat-feed-${clientId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => handlers.onMessage(payload.new),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_conversations', filter: `client_id=eq.${clientId}` },
        (payload) => handlers.onConversation(payload.new, 'INSERT'),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_conversations', filter: `client_id=eq.${clientId}` },
        (payload) => handlers.onConversation(payload.new, 'UPDATE'),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_contacts', filter: `client_id=eq.${clientId}` },
        (payload) => handlers.onContact(payload.new),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // handlers vêm de refs estáveis na página; só o cliente reinicia o canal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);
}
