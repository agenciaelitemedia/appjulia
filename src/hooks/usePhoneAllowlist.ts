import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { getBrPhoneVariants } from '@/lib/phoneVariants';

/**
 * Resolve, server-side, the set of phone numbers eligible for the active
 * cross-database filters used by the chat list:
 *
 * - Modo Julia ativa  → phones com `agent_sessions.active = true`  para
 *                       `cod_agent` ∈ codAgents.
 * - Modo Humano       → phones com `agent_sessions.active = false` para
 *                       `cod_agent` ∈ codAgents.
 * - Etapas            → phones em `crm_atendimento_cards.stage_id` ∈ stageIds.
 *
 * Quando vários filtros estão ativos, a lista resultante é a INTERSEÇÃO
 * dos universos. O retorno respeita variantes BR (com/sem 55, com/sem 9).
 *
 * Retorno:
 *   - `null`: nenhum filtro ativo → o consumidor não deve aplicar a
 *             restrição `phone IN (...)` no servidor.
 *   - `string[]`: lista (possivelmente vazia) de telefones permitidos. Lista
 *                 vazia significa "nenhum match" — o consumidor deve
 *                 curto-circuitar a query.
 */
export type ChatModeFilter = 'all' | 'julia' | 'human';

export interface UsePhoneAllowlistArgs {
  modeFilter: ChatModeFilter;
  stageIds: number[];
  codAgents: string[]; // cod_agent das filas acessíveis
}

function expandVariants(numbers: string[]): string[] {
  const set = new Set<string>();
  for (const raw of numbers) {
    const d = String(raw || '').replace(/\D/g, '');
    if (!d) continue;
    set.add(d);
    if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) set.add('55' + d);
    if (d.startsWith('55') && (d.length === 12 || d.length === 13)) set.add(d.slice(2));
    for (const v of getBrPhoneVariants(d)) set.add(v);
  }
  return [...set].filter(Boolean);
}

export function usePhoneAllowlist({ modeFilter, stageIds, codAgents }: UsePhoneAllowlistArgs) {
  const enabled = modeFilter !== 'all' || stageIds.length > 0;
  const cleanCodAgents = Array.from(new Set(codAgents.filter(Boolean).map(String))).sort();
  const cleanStages = Array.from(new Set(stageIds.filter((n) => Number.isFinite(n)))).sort((a, b) => a - b);

  return useQuery({
    queryKey: ['chat-phone-allowlist', modeFilter, cleanStages, cleanCodAgents],
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<string[]> => {
      let modeSet: Set<string> | null = null;
      let stageSet: Set<string> | null = null;

      if (modeFilter !== 'all') {
        if (cleanCodAgents.length === 0) return [];
        const desiredActive = modeFilter === 'julia';
        const rows = await externalDb.raw<{ whatsapp_number: string }>({
          query: `
            SELECT DISTINCT whatsapp_number
            FROM agent_sessions
            WHERE cod_agent::bigint = ANY($1::bigint[])
              AND active = $2
              AND whatsapp_number IS NOT NULL
          `,
          params: [cleanCodAgents.map((c) => Number(c)), desiredActive],
        });
        modeSet = new Set(expandVariants((rows || []).map((r) => r.whatsapp_number)));
      }

      if (cleanStages.length > 0) {
        const rows = await externalDb.raw<{ whatsapp_number: string }>({
          query: `
            SELECT DISTINCT whatsapp_number
            FROM crm_atendimento_cards
            WHERE stage_id = ANY($1::int[])
              AND whatsapp_number IS NOT NULL
          `,
          params: [cleanStages],
        });
        stageSet = new Set(expandVariants((rows || []).map((r) => r.whatsapp_number)));
      }

      // Intersect when both active; otherwise return whichever is non-null.
      let result: Set<string>;
      if (modeSet && stageSet) {
        result = new Set<string>();
        const [smaller, larger] = modeSet.size <= stageSet.size ? [modeSet, stageSet] : [stageSet, modeSet];
        for (const v of smaller) if (larger.has(v)) result.add(v);
      } else if (modeSet) {
        result = modeSet;
      } else if (stageSet) {
        result = stageSet;
      } else {
        result = new Set<string>();
      }
      return Array.from(result);
    },
  });
}