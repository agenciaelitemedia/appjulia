import React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
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
  // Expanded (phone-variant, cod_agent) tuple list — used for the primary
  // lookup that matches the conversation's specific Julia agent.
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

  // All phone variants (without agent) — used for the fallback lookup so
  // that, when the queue's primary agent does NOT match the agent where
  // the card actually lives, we still surface the most recent stage for
  // that phone instead of showing "Sem etapa". This mirrors the previous
  // (working) behavior the user expects: every Julia-linked conversation
  // that has any card in the CRM must show its stage.
  const phoneVariants = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of pairs) {
      const phone = (p.phone || '').replace(/\D/g, '');
      if (!phone) continue;
      for (const v of getBrPhoneVariants(phone)) set.add(v);
    }
    return Array.from(set).sort();
  }, [pairs]);

  return useQuery({
    queryKey: ['crm-stage-by-phone-agent', tuples, phoneVariants],
    queryFn: async () => {
      const map = new Map<string, PhoneStageInfo>();
      if (phoneVariants.length === 0) return map;

      // Single query: fetch the most recent card for each phone variant,
      // regardless of agent. We then index the result two ways:
      //   - `${phone}|${codAgent}` for exact (phone, agent) lookups
      //   - `${phone}` as a phone-only fallback (most recent card)
      // Consumers should prefer the composite key and fall back to the
      // phone-only key when no specific match exists.
      const rows = await externalDb.raw<{
        whatsapp_number: string;
        cod_agent: string;
        stage_id: number;
        stage_name: string | null;
        stage_color: string | null;
        updated_at: string | null;
      }>({
        query: `
          SELECT
            c.whatsapp_number,
            c.cod_agent::text AS cod_agent,
            c.stage_id,
            s.name  AS stage_name,
            s.color AS stage_color,
            c.updated_at
          FROM crm_atendimento_cards c
          LEFT JOIN crm_atendimento_stages s ON c.stage_id = s.id
          WHERE c.whatsapp_number = ANY($1::varchar[])
          ORDER BY c.whatsapp_number, c.updated_at DESC NULLS LAST
        `,
        params: [phoneVariants],
      });

      // Track which (phone-variant) already has a phone-only fallback so
      // we keep the most recent card (rows are already DESC by updated_at).
      const phoneOnlySeen = new Set<string>();

      rows.forEach((r) => {
        const stored = String(r.whatsapp_number);
        const codAgent = String(r.cod_agent);
        const info: PhoneStageInfo = {
          stageId: Number(r.stage_id),
          stageName: r.stage_name ?? undefined,
          stageColor: r.stage_color ?? undefined,
        };
        const variants = getBrPhoneVariants(stored);
        // Composite (phone, agent) keys — exact match path
        for (const v of variants) {
          map.set(`${v}|${codAgent}`, info);
        }
        map.set(`${stored}|${codAgent}`, info);
        // Phone-only fallback — most recent card wins (first row per phone)
        for (const v of variants) {
          if (!phoneOnlySeen.has(v)) {
            phoneOnlySeen.add(v);
            map.set(v, info);
          }
        }
        if (!phoneOnlySeen.has(stored)) {
          phoneOnlySeen.add(stored);
          map.set(stored, info);
        }
      });
      return map;
    },
    enabled: phoneVariants.length > 0,
    // Stale por 5 min sem polling: mudanças reais chegam via invalidateQueries
    // no fluxo do CRM. Antes fazia SELECT no DB externo a cada 60s por sessão.
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: keepPreviousData,
  });
}
