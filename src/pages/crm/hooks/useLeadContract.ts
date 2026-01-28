import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';

interface LeadContractStatus {
  has_contract: boolean;
  is_signed: boolean;
}

export function useLeadHasContract(whatsappNumber: string | undefined, codAgent: string | undefined) {
  return useQuery({
    queryKey: ['lead-contract', whatsappNumber, codAgent],
    queryFn: async () => {
      const result = await externalDb.raw<LeadContractStatus>({
        query: `
          SELECT 
            COUNT(*) > 0 as has_contract,
            COUNT(CASE WHEN status_document = 'SIGNED' THEN 1 END) > 0 as is_signed
          FROM vw_desempenho_julia_contratos 
          WHERE whatsapp = $1 
            AND cod_agent = $2
            AND status_document IN ('CREATED', 'PENDING', 'SIGNED')
        `,
        params: [whatsappNumber, codAgent],
      });
      return result[0] || { has_contract: false, is_signed: false };
    },
    enabled: !!whatsappNumber && !!codAgent,
    staleTime: 1000 * 60 * 2, // Cache por 2 minutos
  });
}
