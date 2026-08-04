import { useQuery } from '@tanstack/react-query';
import { resolveEffectiveClientId } from '@/lib/resolveEffectiveClientId';
import { useEscritoriosIdentity } from '../extend/auth';

/** client_id efetivo (string) do usuário logado — base de todas as métricas do painel. */
export function useOfficeClientId() {
  const { user } = useEscritoriosIdentity();
  return useQuery<string | null>({
    queryKey: ['escritorios', 'client-id', user?.id, user?.client_id],
    enabled: !!user?.id,
    queryFn: () => resolveEffectiveClientId(user, 'escritorios'),
    staleTime: 10 * 60_000,
  });
}