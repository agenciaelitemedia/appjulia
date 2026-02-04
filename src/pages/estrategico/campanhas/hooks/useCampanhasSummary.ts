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
  
  // Calcular métricas do período atual
  const currentCampaignIds = new Set(leadsData.map(l => l.campaign_id));
  const totalCampaigns = currentCampaignIds.size;
  const leadsPerCampaign = totalCampaigns > 0 ? Math.round(totalLeads / totalCampaigns) : 0;
  
  // Calcular métricas do período anterior para comparação
  const previousCampaignIds = new Set(previousData.map(p => p.campaign_id));
  const previousTotalCampaigns = previousCampaignIds.size;
  const previousTotalLeads = previousData.length;
  const previousLeadsPerCampaign = previousTotalCampaigns > 0 
    ? Math.round(previousTotalLeads / previousTotalCampaigns) 
    : 0;
  
  // Calcular leads da plataforma top no período anterior
  const previousPlatformCounts = previousData.reduce((acc, p) => {
    const platform = p.platform || 'outros';
    acc[platform] = (acc[platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topPlatform = platformData[0]?.platform || '-';
  const previousTopPlatformLeads = previousPlatformCounts[topPlatform] || 0;
  
  const summary: CampaignSummary = {
    totalCampaigns,
    totalLeads,
    leadsPerCampaign,
    conversionRate,
    qualifiedLeads,
    topPlatform,
    topPlatformLeads: platformData[0]?.total_leads || 0,
    previousTotalCampaigns,
    previousTotalLeads,
    previousQualifiedLeads,
    previousLeadsPerCampaign,
    previousTopPlatformLeads,
  };
  
  return summary;
}
