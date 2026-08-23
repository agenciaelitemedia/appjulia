import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { supabase } from '../extend/db';

export interface JuliaRealtimeHandlers {
  onMessage: (payload: any) => void;
  onConversation: (payload: any, eventType: 'INSERT' | 'UPDATE', old?: any) => void;
  onContact: (payload: any) => void;
}

interface HubApi {
  /** Registra handlers e devolve a função de remoção. */
  subscribe: (h: JuliaRealtimeHandlers) => () => void;
}

const HubContext = createContext<HubApi | null>(null);

/**
 * Um único canal Realtime por página, compartilhado entre as listas das abas.
 * Evita 3 assinaturas duplicadas (uma por aba).
 */
export function JuliaChatRealtimeProvider({ clientId, children }: { clientId: string | null; children: ReactNode }) {
  const handlersRef = useRef<Set<JuliaRealtimeHandlers>>(new Set());

  const api = useMemo<HubApi>(() => ({
    subscribe: (h) => {
      handlersRef.current.add(h);
      return () => { handlersRef.current.delete(h); };
    },
  }), []);

  useEffect(() => {
    if (!clientId) return;

    const each = (fn: (h: JuliaRealtimeHandlers) => void) => {
      handlersRef.current.forEach((h) => {
        try { fn(h); } catch { /* nunca derruba o canal por erro de handler */ }
      });
    };

    const channel = supabase
      .channel(`julia-chat-feed-${clientId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (p) => each((h) => h.onMessage(p.new)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_conversations', filter: `client_id=eq.${clientId}` },
        (p) => each((h) => h.onConversation(p.new, 'INSERT')))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_conversations', filter: `client_id=eq.${clientId}` },
        (p) => each((h) => h.onConversation(p.new, 'UPDATE', p.old)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_contacts', filter: `client_id=eq.${clientId}` },
        (p) => each((h) => h.onContact(p.new)))
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [clientId]);

  return <HubContext.Provider value={api}>{children}</HubContext.Provider>;
}

export function useJuliaChatRealtimeHub() {
  return useContext(HubContext);
}
