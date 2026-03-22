import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';

interface FollowupReturnRateResult {
  totalLeads: number;
  returned: number;
  returnRate: number;
}

export function useFollowupReturnRate(agentCodes: string[], dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['crm-followup-return-rate', agentCodes, dateFrom, dateTo],
    queryFn: async (): Promise<FollowupReturnRateResult> => {
      if (!agentCodes.length) return { totalLeads: 0, returned: 0, returnRate: 0 };

      const params: (string | string[] | null)[] = [agentCodes];
      let dateFilter = '';
      let fqDateFilter = '';

      if (dateFrom) {
        params.push(dateFrom);
        dateFilter += ` AND (send_date AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length}::date`;
        fqDateFilter += ` AND (fq.send_date AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length}::date`;
      }
      if (dateTo) {
        params.push(dateTo);
        dateFilter += ` AND (send_date AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length}::date`;
        fqDateFilter += ` AND (fq.send_date AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length}::date`;
      }

      const result = await externalDb.raw<{
        total_leads: string;
        returned: string;
      }[]>({
        query: `
          WITH current_state AS (
            SELECT DISTINCT ON (session_id)
              session_id,
              id as queue_id,
              state,
              step_number
            FROM followup_queue
            WHERE cod_agent::text = ANY($1::varchar[])
              ${dateFilter}
            ORDER BY session_id, send_date DESC
          ),
          leads_with_response AS (
            SELECT DISTINCT fq.session_id
            FROM followup_queue fq
            INNER JOIN followup_response fr ON fr.followup_queue_id = fq.id
            WHERE fq.cod_agent::text = ANY($1::varchar[])
              AND fq.session_id IN (SELECT session_id FROM current_state WHERE state = 'STOP')
              ${fqDateFilter}
          )
          SELECT 
            COUNT(*)::text as total_leads,
            COUNT(*) FILTER (
              WHERE state = 'STOP' 
                AND step_number <> 0 
                AND session_id IN (SELECT session_id FROM leads_with_response)
            )::text as returned
          FROM current_state
        `,
        params,
      });

      const flatResult = Array.isArray(result) ? result.flat() : [];
      const row = flatResult[0];
      const totalLeads = parseInt(row?.total_leads || '0', 10);
      const returned = parseInt(row?.returned || '0', 10);
      const returnRate = totalLeads > 0 ? (returned / totalLeads) * 100 : 0;

      return { totalLeads, returned, returnRate };
    },
    enabled: agentCodes.length > 0,
    staleTime: 1000 * 60,
  });
}
