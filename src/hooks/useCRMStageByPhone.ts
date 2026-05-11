import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { getBrPhoneVariants } from '@/lib/phoneVariants';

export interface PhoneStageInfo {
  stageId: number;
  stageName?: string;
  stageColor?: string;
}

export interface PhoneAgentPair {
  phone: string;
  codAgent: string | null | undefined;
}

/**
 * Maps (phone, cod_agent) pairs to their CRM stage from `crm_atendimento_cards`.
 *
 * Why per-agent: the same phone may exist as a card under multiple agents
 * (lead atendido por mais de uma operação Julia). Buscar só por telefone
 * pode trazer um card de outro agente, sobrescrevendo a etapa correta da
 * conversa atual com vazio ou com etapa alheia. Filtrar por (telefone,
 * cod_agent) garante que cada conversa receba a etapa do **seu** agente.
 *
 * Lookup key in returned map: `${phoneVariant}|${codAgent}`.
 */
export function useCRMStageByPhone(pairs: PhoneAgentPair[]) {
  // Build expanded (phone-variant, cod_agent) tuple list, deduped + sorted
  // for a stable React Query cache key.
  const tuples = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of pairs) {
      const phone = (p.phone || '').replace(/\D/g, '');
      const codAgent = (p.codAgent ?? '').toString().trim();
      if (!phone || !codAgent) continue;
      for (const v of getBrPhoneVariants(phone)) {
        set.add(`${v}|${codAgent}`);
      }
    }
    return Array.from(set).sort();
  }, [pairs]);

  return useQuery({
    queryKey: ['crm-stage-by-phone-agent', tuples],
    queryFn: async () => {
      const map = new Map<string, PhoneStageInfo>();
      if (tuples.length === 0) return map;

      const phonesArr: string[] = [];
      const agentsArr: string[] = [];
      for (const t of tuples) {
        const idx = t.indexOf('|');
        phonesArr.push(t.slice(0, idx));
        agentsArr.push(t.slice(idx + 1));
      }

      const rows = await externalDb.raw<{
        whatsapp_number: string;
        cod_agent: string;
        stage_id: number;
        stage_name: string | null;
        stage_color: string | null;
      }>({
        query: `
          SELECT DISTINCT ON (c.whatsapp_number, c.cod_agent)
            c.whatsapp_number,
            c.cod_agent::text AS cod_agent,
            c.stage_id,
            s.name  AS stage_name,
            s.color AS stage_color
          FROM crm_atendimento_cards c
          LEFT JOIN crm_atendimento_stages s ON c.stage_id = s.id
          WHERE (c.whatsapp_number, c.cod_agent::text) IN (
            SELECT * FROM unnest($1::varchar[], $2::varchar[])
          )
          ORDER BY c.whatsapp_number, c.cod_agent, c.updated_at DESC NULLS LAST
        `,
        params: [phonesArr, agentsArr],
      });

      rows.forEach((r) => {
        const stored = String(r.whatsapp_number);
        const codAgent = String(r.cod_agent);
        const info: PhoneStageInfo = {
          stageId: Number(r.stage_id),
          stageName: r.stage_name ?? undefined,
          stageColor: r.stage_color ?? undefined,
        };
        // Map every BR variant of this number to the same (phone, agent) key.
        for (const v of getBrPhoneVariants(stored)) {
          map.set(`${v}|${codAgent}`, info);
        }
        map.set(`${stored}|${codAgent}`, info);
      });
      return map;
    },
    enabled: tuples.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
