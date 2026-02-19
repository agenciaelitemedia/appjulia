import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { ContractInfo } from '../types';

export function useContractInfo(whatsappNumber: string, codAgent: string, enabled: boolean = false) {
  return useQuery({
    queryKey: ['contract-info', whatsappNumber, codAgent],
    queryFn: async () => {
      const result = await externalDb.raw<ContractInfo>({
        query: `
          SELECT 
            zapsing_doctoken,
            status_document,
            signer_name,
            signer_cpf,
            signer_uf,
            signer_cidade,
            signer_bairro,
            signer_endereco,
            signer_cep,
            data_contrato,
            data_assinatura,
            cod_document,
            situacao,
            resumo_do_caso,
            case_title,
            case_category_name,
            case_category_color,
            cod_agent,
            name as agent_name,
            business_name,
            whatsapp
          FROM vw_painelv2_desempenho_julia_contratos
          WHERE whatsapp = $1
            AND cod_agent::text = $2
          ORDER BY data_contrato DESC
          LIMIT 1
        `,
        params: [whatsappNumber, codAgent],
      });
      return result[0] || null;
    },
    enabled: enabled && !!whatsappNumber && !!codAgent,
    staleTime: 1000 * 60 * 2,
  });
}
