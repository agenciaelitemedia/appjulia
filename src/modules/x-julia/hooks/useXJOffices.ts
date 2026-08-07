/**
 * Escritórios (clientID) que possuem agentes X-Julia, com contagem de agentes.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../extend/db';
import { externalDb } from '../extend/db';

export interface XJOfficeRow {
  clientId: string;
  name: string;
  businessName: string | null;
  agents: number;
  activeAgents: number;
  providers: string[];
}

export function useXJOffices() {
  return useQuery<XJOfficeRow[]>({
    queryKey: ['x-julia', 'offices'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xj_agents')
        .select('client_id, is_active, llm_provider');
      if (error) throw error;

      const grouped = new Map<string, XJOfficeRow>();
      for (const row of data || []) {
        const clientId = String((row as any).client_id ?? '');
        if (!clientId) continue;
        const current =
          grouped.get(clientId) ??
          ({ clientId, name: `ClientID ${clientId}`, businessName: null, agents: 0, activeAgents: 0, providers: [] } as XJOfficeRow);
        current.agents += 1;
        if ((row as any).is_active) current.activeAgents += 1;
        const provider = String((row as any).llm_provider ?? '');
        if (provider && !current.providers.includes(provider)) current.providers.push(provider);
        grouped.set(clientId, current);
      }

      const rows = Array.from(grouped.values());

      // Nomes vêm da base de clientes (Postgres externo).
      await Promise.all(
        rows.map(async (row) => {
          try {
            const found = await externalDb.raw<any>({
              query: 'SELECT id, name, business_name FROM clients WHERE id = $1 LIMIT 1',
              params: [Number(row.clientId)],
            });
            const client = Array.isArray(found) ? found[0] : null;
            if (client) {
              row.name = client.name || row.name;
              row.businessName = client.business_name ?? null;
            }
          } catch {
            /* mantém o fallback ClientID */
          }
        }),
      );

      return rows.sort((a, b) => b.agents - a.agents);
    },
  });
}