 import { useQuery } from '@tanstack/react-query';
 import { externalDb } from '@/lib/externalDb';
 import { CRMFollowupInfo } from '../types';
 
 interface FollowupActiveRow {
   cod_agent: string;
   whatsapp: string;
   step_number: number;
   node_count: number;
   followup_from: number | null;
   followup_to: number | null;
 }
 
 export function useFollowupActiveLeads(agentCodes: string[]) {
   return useQuery({
     queryKey: ['crm-followup-active', agentCodes],
     queryFn: async () => {
       if (!agentCodes.length) return new Map<string, CRMFollowupInfo>();
 
       const query = `
         WITH ranked_followup AS (
           SELECT 
             fq.cod_agent::text as cod_agent,
          fq.whatsapp::text as whatsapp,
             fq.step_number,
             fq.node_count,
             fq.followup_from,
             fq.followup_to,
             fq.created_at,
             ROW_NUMBER() OVER (
            PARTITION BY fq.cod_agent, fq.whatsapp 
               ORDER BY fq.created_at DESC
             ) as rn
        FROM vw_send_followup_queue_card fq
        WHERE fq.cod_agent::text = ANY($1::varchar[])
         )
         SELECT cod_agent, whatsapp, step_number, node_count, followup_from, followup_to
         FROM ranked_followup
         WHERE rn = 1
       `;
 
       const result = await externalDb.raw<FollowupActiveRow>({
         query,
         params: [agentCodes],
       });
 
       // Transform into Map for O(1) lookup
       const map = new Map<string, CRMFollowupInfo>();
       
       result.forEach((row) => {
         const key = `${row.cod_agent}::${row.whatsapp}`;
         const isInfinite = row.followup_from !== null && row.followup_to !== null;
         const hasReachedInfinite = isInfinite && row.step_number >= (row.followup_to ?? 0);
 
         let stageLabel: string;
         if (hasReachedInfinite) {
           stageLabel = '∞/∞';
         } else if (isInfinite) {
           stageLabel = `${row.step_number}/∞`;
         } else {
           stageLabel = `${row.step_number}/${row.node_count}`;
         }
 
         map.set(key, {
           cod_agent: row.cod_agent,
           whatsapp: row.whatsapp,
           step_number: row.step_number,
           node_count: row.node_count,
           followup_from: row.followup_from,
           followup_to: row.followup_to,
           is_infinite: isInfinite,
           stage_label: stageLabel,
         });

      let stageLabel: string;
      let tooltipText: string;
      
      if (row.step_number === 0) {
        stageLabel = 'Finalizado';
        tooltipText = 'O FollowUp foi concluído. Todas as etapas foram executadas ou o lead respondeu.';
      } else if (hasReachedInfinite) {
        stageLabel = '∞/∞';
        tooltipText = `FollowUp Infinito ativo. O lead está no loop contínuo de mensagens (etapas ${row.followup_from} a ${row.followup_to}).`;
      } else if (isInfinite) {
        stageLabel = `${row.step_number}/∞`;
        tooltipText = `Etapa ${row.step_number} de ${row.node_count}. Ao atingir a etapa ${row.followup_to}, entrará em loop infinito.`;
      } else {
        stageLabel = `${row.step_number}/${row.node_count}`;
        tooltipText = `Etapa ${row.step_number} de ${row.node_count}. O lead está aguardando resposta e receberá mensagens automáticas.`;
      }

      map.set(key, {
        cod_agent: row.cod_agent,
        whatsapp: row.whatsapp,
        step_number: row.step_number,
        node_count: row.node_count,
        followup_from: row.followup_from,
        followup_to: row.followup_to,
        is_infinite: isInfinite,
        stage_label: stageLabel,
        tooltip_text: tooltipText,
      });
       });
 
       return map;
     },
     enabled: agentCodes.length > 0,
     staleTime: 1000 * 60, // Cache for 1 minute
   });
 }