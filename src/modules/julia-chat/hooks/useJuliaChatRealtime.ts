import { useEffect, useRef } from 'react';
import { supabase } from '../extend/db';
import { useJuliaChatRealtimeHub, type JuliaRealtimeHandlers } from './useJuliaChatRealtimeHub';

type Handlers = JuliaRealtimeHandlers;

/**
 * Tempo real do feed do JulIA Chat. Dentro do `JuliaChatRealtimeProvider` apenas se
 * registra no canal compartilhado; fora dele, abre o próprio canal (fallback).
 */
export function useJuliaChatRealtime(clientId: string | null, handlers: Handlers) {
  const hub = useJuliaChatRealtimeHub();
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!hub) return;
    return hub.subscribe({
      onMessage: (p) => ref.current.onMessage(p),
      onConversation: (p, t, o) => ref.current.onConversation(p, t, o),
      onContact: (p) => ref.current.onContact(p),
    });
  }, [hub]);

  useEffect(() => {
    if (hub || !clientId) return;

    const channel = supabase
      .channel(`julia-chat-feed-${clientId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => ref.current.onMessage(payload.new))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_conversations', filter: `client_id=eq.${clientId}` },
        (payload) => ref.current.onConversation(payload.new, 'INSERT'))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_conversations', filter: `client_id=eq.${clientId}` },
        (payload) => ref.current.onConversation(payload.new, 'UPDATE', payload.old))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_contacts', filter: `client_id=eq.${clientId}` },
        (payload) => ref.current.onContact(payload.new))
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [hub, clientId]);
}
