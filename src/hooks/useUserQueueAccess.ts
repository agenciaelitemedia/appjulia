import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';

export interface UserQueueAccess {
  queue_access: 'all' | 'specific';
  queue_ids: string[];
}

/**
 * Retorna o allowlist de filas do usuário logado.
 * - queue_access='all' → enxerga todas as filas
 * - queue_access='specific' → enxerga apenas queue_ids
 *
 * Cache de 60s; ao salvar mudanças, invalide via
 *   queryClient.invalidateQueries({ queryKey: ['user-queue-access', userId] })
 */
export function useUserQueueAccess() {
  const { user } = useAuth();
  return useQuery<UserQueueAccess>({
    queryKey: ['user-queue-access', user?.id],
    queryFn: async () => {
      if (!user?.id) return { queue_access: 'all', queue_ids: [] };
      try {
        return await externalDb.getUserQueueAccess(user.id);
      } catch {
        // Se a tabela ainda não foi inicializada, default = 'all' (não restringe)
        return { queue_access: 'all', queue_ids: [] };
      }
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });
}
