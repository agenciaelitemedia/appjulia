import { useQuery } from '@tanstack/react-query';
import { externalDb } from '../extend/db';

export interface OfficePlan {
  id: number;
  name: string;
  leads_limit: number;
  price: number;
}

export function useOfficePlans() {
  return useQuery<OfficePlan[]>({
    queryKey: ['escritorios', 'plans'],
    queryFn: () => externalDb.getPlans<OfficePlan>(),
    staleTime: 5 * 60_000,
  });
}