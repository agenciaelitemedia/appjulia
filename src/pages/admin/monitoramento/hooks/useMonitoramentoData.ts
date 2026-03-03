import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { toast } from '@/hooks/use-toast';

export function useUserLinkedAgents(userId: number) {
  return useQuery({
    queryKey: ['user-linked-agents', userId],
    queryFn: () => externalDb.getUserAgents(userId),
    enabled: !!userId,
  });
}

export function useAvailableAgents(userId: number) {
  return useQuery({
    queryKey: ['available-agents', userId],
    queryFn: () => externalDb.getAvailableAgentsForUser(userId),
    enabled: !!userId,
  });
}

export function useLinkAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, agentId, codAgent }: { userId: number; agentId: number | null; codAgent: string }) => {
      return externalDb.insertUserAgent(userId, agentId, codAgent);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-linked-agents', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['available-agents', variables.userId] });
      toast({ title: 'Agente vinculado', description: 'O agente foi vinculado com sucesso.' });
    },
    onError: (error: Error) => {
      const msg = error.message.includes('duplicate')
        ? error.message.split(': ')[1] || error.message
        : error.message;
      toast({ title: 'Erro ao vincular', description: msg, variant: 'destructive' });
    },
  });
}

export function useUnlinkAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, codAgent }: { userId: number; codAgent: string }) => {
      return externalDb.deleteUserAgent(userId, codAgent);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-linked-agents', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['available-agents', variables.userId] });
      toast({ title: 'Agente desvinculado', description: 'O vínculo foi removido com sucesso.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao desvincular', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateAgentOwnership() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, codAgent, agentId }: { userId: number; codAgent: string; agentId: number | null }) => {
      return externalDb.updateUserAgentOwnership(userId, codAgent, agentId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-linked-agents', variables.userId] });
      toast({ title: 'Vínculo atualizado', description: 'O tipo de vínculo foi alterado com sucesso.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });
}
