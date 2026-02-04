import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { CampanhasFiltersState, CampaignFunnelData } from '../types';

export function useCampaignsFunnelByGroup(filters: CampanhasFiltersState) {
  return useQuery({
    queryKey: ['campaigns-funnel-by-group', filters.agentCodes, filters.dateFrom, filters.dateTo],
    queryFn: async () => {
      if (!filters.agentCodes.length) return [];

      const query = `
        WITH campaign_leads AS (
          SELECT DISTINCT
            (campaign_data::jsonb)->>'sourceID' || '::' || 
            (campaign_data::jsonb)->>'title' as group_key,
            ca.cod_agent::text,
            COALESCE(
              NULLIF((campaign_data::jsonb)->>'phone', ''),
              s.whatsapp_number::text
            ) as whatsapp
          FROM campaing_ads ca
          LEFT JOIN sessions s ON s.id = ca.session_id::int
          WHERE ca.cod_agent::text = ANY($1)
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3
            AND (campaign_data::jsonb)->>'sourceID' IS NOT NULL
        ),

        lead_counts AS (
          SELECT 
            (campaign_data::jsonb)->>'sourceID' || '::' || 
            (campaign_data::jsonb)->>'title' as group_key,
            COUNT(*)::int as total_leads
          FROM campaing_ads
          WHERE cod_agent::text = ANY($1)
            AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2
            AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3
            AND (campaign_data::jsonb)->>'sourceID' IS NOT NULL
          GROUP BY group_key
        ),

        crm_cards AS (
          SELECT 
            cl.group_key,
            c.id as card_id,
            c.stage_id
          FROM campaign_leads cl
          INNER JOIN crm_atendimento_cards c 
            ON c.cod_agent = cl.cod_agent 
            AND c.whatsapp_number = cl.whatsapp
        ),

        stages AS (
          SELECT id, name, color, position
          FROM crm_atendimento_stages
          WHERE is_active = true
        ),

        stage_counts AS (
          SELECT 
            cc.group_key,
            s.id as stage_id,
            s.name as stage_name,
            s.color as stage_color,
            s.position,
            COUNT(DISTINCT cc.card_id)::int as count
          FROM crm_cards cc
          JOIN stages s ON s.id = cc.stage_id
          GROUP BY cc.group_key, s.id, s.name, s.color, s.position
        )

        SELECT 
          lc.group_key,
          lc.total_leads,
          COALESCE(
            json_agg(
              json_build_object(
                'stage_id', sc.stage_id,
                'stage_name', sc.stage_name,
                'stage_color', sc.stage_color,
                'position', sc.position,
                'count', sc.count
              ) ORDER BY sc.position
            ) FILTER (WHERE sc.stage_id IS NOT NULL),
            '[]'::json
          ) as stages
        FROM lead_counts lc
        LEFT JOIN stage_counts sc ON sc.group_key = lc.group_key
        GROUP BY lc.group_key, lc.total_leads
      `;

      const result = await externalDb.raw<CampaignFunnelData>({
        query,
        params: [
          filters.agentCodes,
          filters.dateFrom,
          filters.dateTo
        ]
      });

      return result;
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
