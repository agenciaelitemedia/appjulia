/**
 * extend/webhooks — webhooks cadastrados no chat, usados no nó "Enviar para webhook".
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './db';
import { useFlowClientId } from './auth';

export interface FlowWebhookOption {
  id: string;
  name: string;
  url: string;
}

export function useFlowWebhooks() {
  const { data: clientId } = useFlowClientId();
  return useQuery<FlowWebhookOption[]>({
    queryKey: ['flow-builder', 'webhooks', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_webhooks')
        .select('id, name, url')
        .eq('client_id', String(clientId))
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as FlowWebhookOption[];
    },
    staleTime: 60_000,
  });
}