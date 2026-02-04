import { useCampanhasRaw, useCampanhasPrevious, useCampanhasByPlatform, useCampanhasLeads } from './useCampanhasData';
import { useCampanhasQualified, useCampanhasQualifiedPrevious } from './useCampanhasQualified';
import { CampaignSummary, CampanhasFiltersState } from '../types';

export function useCampanhasSummaryData(filters: CampanhasFiltersState): CampaignSummary {
  const { data: rawData = [] } = useCampanhasRaw(filters);
  const { data: previousData = [] } = useCampanhasPrevious(filters);
  const { data: platformData = [] } = useCampanhasByPlatform(filters);
  const { data: leadsData = [] } = useCampanhasLeads(filters);
  const { data: qualifiedData } = useCampanhasQualified(filters);
  const { data: previousQualifiedData } = useCampanhasQualifiedPrevious(filters);
  
  const qualifiedLeads = qualifiedData?.qualified_count || 0;
  const previousQualifiedLeads = previousQualifiedData?.qualified_count || 0;
  
  const totalLeads = rawData.length;
  const conversionRate = totalLeads > 0 
    ? (qualifiedLeads / totalLeads) * 100 
    : 0;
  
  const summary: CampaignSummary = {
    totalCampaigns: new Set(leadsData.map(l => l.campaign_id)).size,
    totalLeads,
    leadsPerCampaign: leadsData.length > 0 
      ? Math.round(totalLeads / new Set(leadsData.map(l => l.campaign_id)).size) || 0
      : 0,
    conversionRate,
    qualifiedLeads,
    topPlatform: platformData[0]?.platform || '-',
    topPlatformLeads: platformData[0]?.total_leads || 0,
    previousTotalCampaigns: new Set(previousData.map(p => p.campaign_id)).size,
    previousTotalLeads: previousData.length,
    previousQualifiedLeads,
  };
  
  return summary;
}
