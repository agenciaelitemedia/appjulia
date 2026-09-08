import { useQuery } from '@tanstack/react-query';
import { useAuth, resolveEffectiveClientId } from '../extend/auth';

/**
 * client_id efetivo do usuário logado (herdado quando for membro de equipe).
 * `isGlobalAdmin` = admin sem escritório próprio → vê todos os escritórios.
 */
export function useAlertsClientId() {
  const { user } = useAuth();
  const isGlobalAdmin = (user as any)?.role === 'admin' && !(user as any)?.client_id;

  const query = useQuery<string | null>({
    queryKey: ['alerts', 'client-id', (user as any)?.id, (user as any)?.client_id],
    enabled: !!(user as any)?.id && !isGlobalAdmin,
    queryFn: () => resolveEffectiveClientId(user as any, 'notificacoes-alertas'),
    staleTime: 10 * 60_000,
  });

  return {
    clientId: query.data ?? null,
    loading: !isGlobalAdmin && (query.isLoading || query.isFetching) && !query.data,
    isGlobalAdmin,
  };
}
