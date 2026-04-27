import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';

export interface QueueMember {
  user_id: number;
  role: string;
  name: string;
  email: string;
  user_role: string;
}

export function useQueueMembers(queueId: string | null) {
  return useQuery<QueueMember[]>({
    queryKey: ['queue-members', queueId],
    queryFn: () => externalDb.listQueueMembers(queueId!),
    enabled: !!queueId,
    staleTime: 30 * 1000,
  });
}

export function useSetQueueMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ queueId, members }: { queueId: string; members: Array<{ user_id: number; role?: string }> }) => {
      await externalDb.setQueueMembers(queueId, members);
      return { queueId };
    },
    onSuccess: ({ queueId }) => {
      qc.invalidateQueries({ queryKey: ['queue-members', queueId] });
      // Quem teve acesso adicionado/removido pode estar em outra sessão; invalida geral
      qc.invalidateQueries({ queryKey: ['user-queue-access'] });
    },
  });
}

export function useSetUserQueues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      userId: number;
      queueIds: string[];
      queueAccess: 'all' | 'specific';
      role?: string;
    }) => {
      await externalDb.setUserQueues(params.userId, params.queueIds, params.queueAccess, params.role);
      return params;
    },
    onSuccess: ({ userId }) => {
      qc.invalidateQueries({ queryKey: ['user-queue-access', userId] });
      qc.invalidateQueries({ queryKey: ['queue-members'] });
    },
  });
}
