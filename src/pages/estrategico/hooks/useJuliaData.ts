import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { getPreviousPeriod } from '@/lib/dateUtils';
import { JuliaSessao, JuliaContrato, JuliaFiltersState, JuliaAgent } from '../types';

export function useJuliaAgents() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['julia-agents', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return externalDb.getCrmAgentsForUser<JuliaAgent>(user.id);
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useJuliaSessoes(filters: JuliaFiltersState) {
  return useQuery({
    queryKey: ['julia-sessoes', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo, perfilAgent } = filters;
      
      if (agentCodes.length === 0) return [];
      
      let query = `
        SELECT 
          cod_agent::text, agent_id, name, business_name, client_id,
          perfil_agent, session_id, total_msg::int, whatsapp::text,
          status_document, max_created_at, created_at
        FROM vw_painelv2_desempenho_julia
        WHERE cod_agent::text = ANY($1::varchar[])
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
      `;
      
      const params: any[] = [agentCodes, dateFrom, dateTo];
      
      if (perfilAgent && perfilAgent !== 'ALL') {
        query += ` AND perfil_agent = $4`;
        params.push(perfilAgent);
      }
      
      query += ` ORDER BY created_at DESC`;
      
      const result = await externalDb.raw<JuliaSessao>({ query, params });
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}

// Hook para buscar sessões do período anterior (para comparação)
export function useJuliaSessoesPrevious(filters: JuliaFiltersState) {
  const { previousDateFrom, previousDateTo } = getPreviousPeriod(filters.dateFrom, filters.dateTo);
  
  return useQuery({
    queryKey: ['julia-sessoes-previous', filters.agentCodes, previousDateFrom, previousDateTo, filters.perfilAgent],
    queryFn: async () => {
      const { agentCodes, perfilAgent } = filters;
      
      if (agentCodes.length === 0) return [];
      
      let query = `
        SELECT 
          cod_agent::text, session_id, total_msg::int
        FROM vw_painelv2_desempenho_julia
        WHERE cod_agent::text = ANY($1::varchar[])
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
      `;
      
      const params: any[] = [agentCodes, previousDateFrom, previousDateTo];
      
      if (perfilAgent && perfilAgent !== 'ALL') {
        query += ` AND perfil_agent = $4`;
        params.push(perfilAgent);
      }
      
      const result = await externalDb.raw<Pick<JuliaSessao, 'cod_agent' | 'session_id' | 'total_msg'>>({ query, params });
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useJuliaContratos(filters: JuliaFiltersState) {
  return useQuery({
    // v2: inclui campo zapsing_doctoken (doc_token do ZapSign) e força refetch após update
    queryKey: ['julia-contratos-v2', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo, statusDocument } = filters;
      
      if (agentCodes.length === 0) return [];
      
      let query = `
        SELECT 
          cod_agent::text, agent_id, name, business_name, client_id,
          perfil_agent, session_id, total_msg::int, whatsapp::text,
          cod_document, zapsing_doctoken, status_document, situacao,
          data_contrato, data_assinatura,
          resumo_do_caso, signer_name, signer_cpf, signer_uf,
          signer_cidade, signer_bairro, signer_endereco, signer_cep,
          case_title, case_category_name, case_category_color, is_confirm
        FROM vw_painelv2_desempenho_julia_contratos
        WHERE cod_agent::text = ANY($1::varchar[])
          AND (data_contrato AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
          AND (data_contrato AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
      `;
      
      const params: any[] = [agentCodes, dateFrom, dateTo];
      
      if (statusDocument) {
        query += ` AND status_document = $4`;
        params.push(statusDocument);
      }
      
      query += ` ORDER BY data_contrato DESC`;
      
      const result = await externalDb.raw<JuliaContrato>({ query, params });
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}

// Hook para buscar contratos do período anterior (para comparação)
export function useJuliaContratosPrevious(filters: JuliaFiltersState) {
  const { previousDateFrom, previousDateTo } = getPreviousPeriod(filters.dateFrom, filters.dateTo);
  
  return useQuery({
    queryKey: ['julia-contratos-previous', filters.agentCodes, previousDateFrom, previousDateTo, filters.statusDocument],
    queryFn: async () => {
      const { agentCodes, statusDocument } = filters;
      
      if (agentCodes.length === 0) return [];
      
      let query = `
        SELECT 
          cod_agent::text, status_document, situacao
        FROM vw_painelv2_desempenho_julia_contratos
        WHERE cod_agent::text = ANY($1::varchar[])
          AND (data_contrato AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
          AND (data_contrato AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
      `;
      
      const params: any[] = [agentCodes, previousDateFrom, previousDateTo];
      
      if (statusDocument) {
        query += ` AND status_document = $4`;
        params.push(statusDocument);
      }
      
      const result = await externalDb.raw<Pick<JuliaContrato, 'cod_agent' | 'status_document' | 'situacao'>>({ query, params });
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}
