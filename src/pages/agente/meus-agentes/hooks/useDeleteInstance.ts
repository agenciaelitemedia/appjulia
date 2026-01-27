import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserAgent } from '../types';

interface DeleteInstanceParams {
  agent: UserAgent;
}

export function useDeleteInstance() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ agent }: DeleteInstanceParams) => {
      if (!agent.evo_instancia || !agent.agent_id_from_agents) {
        throw new Error('Instância ou ID do agente não encontrado');
      }

      const { data, error } = await supabase.functions.invoke('uazapi-admin', {
        body: {
          action: 'delete_instance',
          instanceName: agent.evo_instancia,
          agentId: agent.agent_id_from_agents,
        },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Instância excluída com sucesso');
      queryClient.invalidateQueries({ queryKey: ['user-agents'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir instância', { description: error.message });
    },
  });

  return {
    deleteInstance: mutation.mutate,
    deleteInstanceAsync: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    reset: mutation.reset,
  };
}
