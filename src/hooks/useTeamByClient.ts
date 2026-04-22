import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export interface TeamMemberByClient {
  id: number;
  name: string;
  email: string;
  role: string;
  client_id: string | null;
  photo: string | null;
}

/**
 * Retorna todos os membros da equipe pertencentes ao mesmo client_id
 * do usuário logado. Resolve client_id via vw_equipe (parent fallback
 * para roles não-principais).
 */
export function useTeamByClient() {
  const { user } = useAuth();
  return useQuery<TeamMemberByClient[]>({
    queryKey: ['team-by-client', user?.id],
    queryFn: () => externalDb.getTeamByClient<TeamMemberByClient>(
      user!.id as number,
      String(user!.role || ''),
    ),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}