import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { brPhoneVariants } from '@/lib/phoneNormalize';
import type { ChatSidePanelTarget } from '@/components/chat/ChatSidePanel';

export interface AgentChatTargetResult {
  /** Indica que o cod_agent está vinculado a uma fila ativa. */
  isLinked: boolean;
  /** Conversa-alvo resolvida (contato + fila + conversa). null = não achou. */
  target: ChatSidePanelTarget | null;
  isLoading: boolean;
}

/**
 * Resolve a conversa de chat para um (cod_agent, whatsapp) quando o agente
 * está vinculado a uma fila (queue_agent_links → queues). Usado no CRM da
 * Jul.IA e em Contratos para abrir o painel reusável `ChatSidePanel` em vez
 * do dialog UaZapi direto.
 *
 * Retorna `isLinked=false` se o agente não tem fila ativa (caller deve fazer
 * fallback para o `WhatsAppMessagesDialog` legado).
 */
export function useAgentChatTarget(
  codAgent: string | null | undefined,
  whatsapp: string | null | undefined,
  enabled: boolean = true,
): AgentChatTargetResult {
  const phoneVariants = whatsapp ? brPhoneVariants(whatsapp) : [];
  const query = useQuery({
    queryKey: ['agent-chat-target', codAgent, phoneVariants.join(',')],
    enabled: enabled && !!codAgent && phoneVariants.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<{ isLinked: boolean; target: ChatSidePanelTarget | null }> => {
      if (!codAgent) return { isLinked: false, target: null };

      // 1. Fila ativa do agente
      const { data: links, error: linkErr } = await supabase
        .from('queue_agent_links')
        .select('queue_id, is_primary, queues!inner(id, client_id, is_active, is_deleted)')
        .eq('cod_agent', codAgent);
      if (linkErr) throw linkErr;

      const valid = (links || [])
        .map((r: any) => ({ queue_id: r.queue_id as string, is_primary: !!r.is_primary, queue: r.queues }))
        .filter((r) => r.queue && r.queue.is_active === true && r.queue.is_deleted !== true);
      if (valid.length === 0) return { isLinked: false, target: null };

      const primary = valid.find((r) => r.is_primary) || valid[0];
      const queueId = primary.queue_id;
      const clientId = String(primary.queue.client_id);

      if (phoneVariants.length === 0) {
        return { isLinked: true, target: null };
      }

      // 2. Contato pelo telefone (variantes BR com/sem 9º dígito) no client da fila
      const { data: contacts, error: contactErr } = await supabase
        .from('chat_contacts')
        .select('id')
        .eq('client_id', clientId)
        .in('phone', phoneVariants)
        .limit(1);
      if (contactErr) throw contactErr;
      const contactId = contacts?.[0]?.id;
      if (!contactId) return { isLinked: true, target: null };

      // 3. Conversa mais recente nessa fila para o contato
      const { data: convs } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('queue_id', queueId)
        .eq('contact_id', contactId)
        .order('updated_at', { ascending: false })
        .limit(1);
      const conversationId = convs?.[0]?.id ?? null;

      return {
        isLinked: true,
        target: { contactId, queueId, conversationId },
      };
    },
  });

  return {
    isLinked: query.data?.isLinked ?? false,
    target: query.data?.target ?? null,
    isLoading: query.isLoading,
  };
}