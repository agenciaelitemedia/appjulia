import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { getBrPhoneVariants } from '@/lib/phoneVariants';
import { useDealConversation } from './useDealConversation';
import { useQueueAgentLink } from '@/hooks/useQueueAgentLink';
import { useAgentAliases } from '@/hooks/useAgentAliases';
import { useAgentSessionStatus } from '@/hooks/useAgentSessionStatus';
import { getJuliaLink } from './useCardLinks';
import type { CRMDeal } from '../types';

export interface JuliaContractInfo {
  cod_document: string | null;
  status: 'signed' | 'generated' | 'none';
}

export interface DealJuliaContext {
  isJulia: boolean;
  codAgent: string | null;
  agentAlias: string | null;
  juliaCard: {
    id: number;
    stage_id: number | null;
    stage_name: string | null;
    stage_color: string | null;
    business_name: string | null;
  } | null;
  contract: JuliaContractInfo;
  agentActive: boolean;
}

const normalizePhone = (raw: string | null | undefined) => (raw || '').replace(/\D/g, '');

/**
 * Determines whether a CRM Builder deal is "Júlia": its linked queue is bound
 * to a Júlia agent. Loads the corresponding julia card (by whatsapp + cod_agent),
 * the contract status, the agent alias, and the agent live session status.
 *
 * Safe: if anything fails or the deal doesn't qualify, returns isJulia=false.
 */
export function useDealJuliaContext(deal: CRMDeal | null): DealJuliaContext {
  // 1) Resolve queue from chat link (if any)
  const dealConv = useDealConversation(deal);
  const queueId = dealConv.data?.queueId ?? null;
  const queueLink = useQueueAgentLink(queueId);

  // 2) cod_agent: prefer queue->agent link; fallback to deal.cod_agent
  const codAgent = queueLink.data?.codAgent || deal?.cod_agent || null;
  const isJulia = !!queueLink.data?.hasAgent || !!getJuliaLink(deal);

  // 3) Alias
  const { getAlias } = useAgentAliases();
  const phone = normalizePhone(deal?.contact_phone);

  // 4) Júlia card (external DB)
  const juliaCardQ = useQuery({
    queryKey: ['deal-julia-card', codAgent, phone],
    enabled: !!codAgent && !!phone && isJulia,
    staleTime: 30_000,
    queryFn: async () => {
      const phoneVariants = getBrPhoneVariants(phone);
      const rows = await externalDb.raw<{
        id: number;
        stage_id: number;
        stage_name: string | null;
        stage_color: string | null;
        business_name: string | null;
      }>({
        query: `
          SELECT c.id, c.stage_id, c.business_name,
                 s.name as stage_name, s.color as stage_color
          FROM crm_atendimento_cards c
          LEFT JOIN crm_atendimento_stages s ON c.stage_id = s.id
          WHERE c.whatsapp_number = ANY($1::varchar[]) AND c.cod_agent = $2::bigint
          ORDER BY c.updated_at DESC NULLS LAST
          LIMIT 1
        `,
        params: [phoneVariants, String(codAgent)],
      });
      return rows[0] ?? null;
    },
  });

  // 5) Contract (external DB) — best-effort
  const contractQ = useQuery({
    queryKey: ['deal-julia-contract', codAgent, phone],
    enabled: !!codAgent && !!phone && isJulia,
    staleTime: 60_000,
    queryFn: async (): Promise<JuliaContractInfo> => {
      try {
        const phoneVariants = getBrPhoneVariants(phone);
        const rows = await externalDb.raw<{
          cod_document: string | null;
          status_document: string | null;
          data_assinatura: string | null;
        }>({
          query: `
            SELECT cod_document, status_document, data_assinatura
            FROM vw_painelv2_desempenho_julia_contratos
            WHERE whatsapp = ANY($1::varchar[]) AND cod_agent::text = $2
            ORDER BY data_contrato DESC NULLS LAST
            LIMIT 1
          `,
          params: [phoneVariants, String(codAgent)],
        });
        const row = rows[0];
        if (!row) return { cod_document: null, status: 'none' };
        const isSigned =
          !!row.data_assinatura ||
          (row.status_document || '').toLowerCase().includes('sign');
        return {
          cod_document: row.cod_document,
          status: isSigned ? 'signed' : 'generated',
        };
      } catch {
        return { cod_document: null, status: 'none' };
      }
    },
  });

  // 6) Agent session live status
  const { isActive: agentActive } = useAgentSessionStatus(phone, codAgent || '');

  const businessName = juliaCardQ.data?.business_name ?? null;
  const agentAlias = codAgent ? getAlias(String(codAgent), businessName) : null;

  return {
    isJulia,
    codAgent: codAgent ? String(codAgent) : null,
    agentAlias: agentAlias || null,
    juliaCard: juliaCardQ.data
      ? {
          id: juliaCardQ.data.id,
          stage_id: juliaCardQ.data.stage_id ?? null,
          stage_name: juliaCardQ.data.stage_name,
          stage_color: juliaCardQ.data.stage_color,
          business_name: juliaCardQ.data.business_name,
        }
      : null,
    contract: contractQ.data || { cod_document: null, status: 'none' },
    agentActive: !!agentActive,
  };
}