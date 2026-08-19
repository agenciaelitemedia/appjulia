import { useQuery } from '@tanstack/react-query';
import { externalDb } from '../extend/db';
import type { AlertCrmStage } from '../types';

/** Etapas do CRM de atendimento (banco legado) usadas para detectar qualificação. */
export function useAlertCrmStages() {
  return useQuery({
    queryKey: ['alerts', 'crm-stages'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const rows = await externalDb.raw<AlertCrmStage>({
        query: `SELECT s.id::text AS id, s.name, s.color
                  FROM crm_atendimento_stages s
                 WHERE s.is_active IS NOT FALSE
                 ORDER BY s.position NULLS LAST, s.name`,
        params: [],
      });
      return rows ?? [];
    },
  });
}
