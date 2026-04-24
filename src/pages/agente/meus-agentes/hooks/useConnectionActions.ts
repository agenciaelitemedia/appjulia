import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UaZapiClient } from '@/lib/uazapi/client';
import { UserAgent } from '../types';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function useConnectionActions(agent: UserAgent) {
  const queryClient = useQueryClient();

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!agent.evo_url || !agent.evo_apikey) {
        throw new Error('Credenciais não configuradas');
      }

      const client = new UaZapiClient({
        baseUrl: agent.evo_url,
        token: agent.evo_apikey,
      });

      return client.post('/instance/disconnect');
    },
    onSuccess: () => {
      // Invalidar cache do status de conexão
      queryClient.invalidateQueries({
        queryKey: ['connection-status', agent.evo_url, agent.evo_instancia],
      });
      toast.success('WhatsApp desconectado com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao desconectar:', error);
      toast.error('Erro ao desconectar WhatsApp');
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!agent.evo_url || !agent.evo_apikey) {
        throw new Error('Credenciais não configuradas');
      }

      const client = new UaZapiClient({
        baseUrl: agent.evo_url,
        token: agent.evo_apikey,
      });

      return client.post('/instance/connect');
    },
    onSuccess: () => {
      // Re-resolve the queue phone after pairing (UaZapi `owner` only
      // becomes available after the device is connected). Fire-and-forget.
      const queueId = (agent as unknown as { queue_id?: string }).queue_id;
      if (queueId) {
        // Wait a moment for pairing to settle, then resolve.
        setTimeout(() => {
          supabase.functions
            .invoke('queue-resolve-phone', { body: { queue_id: queueId } })
            .catch((err) => console.warn('[useConnectionActions] queue-resolve-phone failed:', err));
        }, 5000);
      }
    },
    onError: (error) => {
      console.error('Erro ao iniciar conexão:', error);
      toast.error('Erro ao iniciar conexão');
    },
  });

  return {
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
    connect: connectMutation.mutate,
    isConnecting: connectMutation.isPending,
  };
}
