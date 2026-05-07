import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LastMessageMeta {
  last_message_at: string | null;
  last_message_from_me: boolean | null;
  last_customer_message_at: string | null;
}

const EMPTY_META: LastMessageMeta = {
  last_message_at: null,
  last_message_from_me: null,
  last_customer_message_at: null,
};

/**
 * Deriva, a partir de chat_messages, os metadados da última mensagem por
 * conversa — necessário para que evaluateSla consiga distinguir FRT / NRT / TTR.
 *
 * Os campos last_customer_message_at e last_message_from_me NÃO existem em
 * chat_conversations; eles vivem implicitamente em chat_messages.
 */
export function useConversationsLastMessageMeta(conversationIds: string[]) {
  const stableIds = useMemo(
    () => Array.from(new Set(conversationIds.filter(Boolean))).sort(),
    [conversationIds],
  );
  const key = stableIds.join(',');

  const { data } = useQuery({
    queryKey: ['conv-last-message-meta', key],
    enabled: stableIds.length > 0,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      // Pega até as últimas 200 mensagens não-internas por lote — suficiente
      // para capturar a última msg + última msg do cliente das conversas visíveis.
      // Limite proporcional ao nº de conversas (com folga para histórico).
      const ids = stableIds.slice(0, 200);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('conversation_id, timestamp, from_me, internal_note')
        .in('conversation_id', ids)
        .order('timestamp', { ascending: false })
        .limit(Math.max(ids.length * 20, 200));
      if (error) throw error;

      const map = new Map<string, LastMessageMeta>();
      for (const row of (data ?? []) as any[]) {
        if (row.internal_note) continue;
        const cid = row.conversation_id as string;
        const ts = row.timestamp as string | null;
        const fromMe = !!row.from_me;
        let entry = map.get(cid);
        if (!entry) {
          entry = { last_message_at: null, last_message_from_me: null, last_customer_message_at: null };
          map.set(cid, entry);
        }
        if (entry.last_message_at === null) {
          entry.last_message_at = ts;
          entry.last_message_from_me = fromMe;
        }
        if (!fromMe && entry.last_customer_message_at === null) {
          entry.last_customer_message_at = ts;
        }
      }
      return map;
    },
  });

  return {
    metaMap: data ?? new Map<string, LastMessageMeta>(),
    getMeta: (id: string | undefined | null): LastMessageMeta =>
      (id && data?.get(id)) || EMPTY_META,
  };
}