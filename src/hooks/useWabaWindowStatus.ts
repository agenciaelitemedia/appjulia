import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const WABA_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface WabaWindowStatus {
  /** true quando a conversa é da API Oficial (Meta Cloud). */
  isWaba: boolean;
  /** true quando não é possível enviar mensagem livre (fora da janela de 24h). */
  isClosed: boolean;
  /** Última mensagem recebida do cliente nesta conversa (ISO), se houver. */
  lastInboundAt: string | null;
  isLoading: boolean;
}

interface Params {
  contactId: string | null | undefined;
  conversationId: string | null | undefined;
  /** Canal da conversa/fila: só aplicamos a regra quando é API Oficial. */
  isWaba: boolean;
}

/**
 * Janela de atendimento da API Oficial do WhatsApp (24h).
 *
 * A Meta só aceita mensagem livre até 24 horas depois da última mensagem
 * enviada pelo cliente (erro 131047 fora disso). Aqui buscamos a última
 * mensagem recebida da conversa e derivamos se a janela está aberta.
 * Conversas não oficiais (UaZapi) nunca são bloqueadas.
 */
export function useWabaWindowStatus({ contactId, conversationId, isWaba }: Params): WabaWindowStatus {
  const enabled = !!isWaba && !!contactId;

  const { data, isLoading } = useQuery({
    queryKey: ['waba-window', contactId ?? null, conversationId ?? null],
    enabled,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      let query = supabase
        .from('chat_messages')
        .select('timestamp')
        .eq('contact_id', contactId as string)
        .eq('from_me', false)
        .order('timestamp', { ascending: false })
        .limit(1);
      if (conversationId) query = query.eq('conversation_id', conversationId);
      const { data: rows, error } = await query;
      if (error) throw error;
      return (rows?.[0]?.timestamp as string | undefined) ?? null;
    },
  });

  const lastInboundAt = data ?? null;
  const lastTs = lastInboundAt ? new Date(lastInboundAt).getTime() : null;
  const isClosed = enabled && !isLoading
    ? (!lastTs || Number.isNaN(lastTs) || Date.now() - lastTs > WABA_WINDOW_MS)
    : false;

  return { isWaba: !!isWaba, isClosed, lastInboundAt, isLoading };
}
