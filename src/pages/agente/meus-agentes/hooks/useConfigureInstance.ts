import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserAgent, CreateInstanceResponse } from '../types';

interface ConfigureInstanceParams {
  agent: UserAgent;
  instanceName: string;
}

export function useConfigureInstance() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ agent, instanceName }: ConfigureInstanceParams): Promise<CreateInstanceResponse> => {
      if (!agent.agent_id_from_agents) {
        throw new Error('ID do agente não encontrado');
      }

      const { data, error } = await supabase.functions.invoke('uazapi-admin', {
        body: {
          action: 'create_instance',
          agentId: agent.agent_id_from_agents,
          instanceName,
          codAgent: agent.cod_agent,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao criar instância');
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro desconhecido ao criar instância');
      }

      return data as CreateInstanceResponse;
    },
    onSuccess: (data, variables) => {
      toast.success('Instância configurada com sucesso!', {
        description: `Instância "${data.instanceName}" criada. Agora você pode conectar escaneando o QR Code.`,
      });

      // Invalidate queries to refresh the agent list and connection status
      queryClient.invalidateQueries({ queryKey: ['user-agents'] });
      queryClient.invalidateQueries({
        queryKey: ['connection-status', variables.agent.evo_url, variables.agent.evo_instancia],
      });
    },
    onError: (error: Error) => {
      toast.error('Erro ao configurar instância', {
        description: error.message,
      });
    },
  });

  return {
    configureInstance: mutation.mutate,
    configureInstanceAsync: mutation.mutateAsync,
    isConfiguring: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
