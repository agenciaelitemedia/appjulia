// Tipos para o módulo de Campanhas Ads

export interface CampaignData {
  title?: string;
  body?: string;
  sourceApp?: string; // facebook | instagram | google
  sourceType?: string; // ad | organic
  sourceID?: string;
  sourceURL?: string;
  mediaType?: number;
  mediaURL?: string;
  thumbnailURL?: string;
  thumbnail?: string;
  conversionSource?: string; // FB_Ads | IG_Ads | etc
  greetingMessageBody?: string;
  entryPointConversionApp?: string;
  entryPointConversionSource?: string;
  sourceDevice?: string;
}

export interface CampaignAd {
  id: string;
  cod_agent: string;
  session_id: string;
  type: string;
  campaign_data: CampaignData;
  created_at: string;
}

export interface CampaignLead {
  campaign_id: string;
  campaign_title: string;
  platform: string;
  total_leads: number;
  first_lead: string;
  last_lead: string;
}

export interface CampaignFunnelStage {
  stage_name: string;
  stage_color: string;
  position: number;
  count: number;
  percentage: number;
  conversionRate?: number;
}

export interface CampaignPlatformStats {
  platform: string;
  total_leads: number;
  percentage: number;
}

export interface CampaignEvolutionPoint {
  date: string;
  total: number;
  facebook?: number;
  instagram?: number;
  google?: number;
  outros?: number;
}

export interface CampaignHeatmapCell {
  day: number; // 0-6 (Domingo-Sábado)
  hour: number; // 0-23
  count: number;
}

export interface CampaignSummary {
  totalCampaigns: number;
  totalLeads: number;
  leadsPerCampaign: number;
  conversionRate: number;
  qualifiedLeads: number;
  topPlatform: string;
  topPlatformLeads: number;
  // Comparativos
  previousTotalCampaigns?: number;
  previousTotalLeads?: number;
  previousQualifiedLeads?: number;
}

export interface CampanhasFiltersState {
  search: string;
  agentCodes: string[];
  dateFrom: string;
  dateTo: string;
}

// Informação de cada fonte/URL da campanha (agrupada)
export interface CampaignSource {
  source_url: string;
  platform: string;
  greeting_message: string;
  device: string;
  created_at: string;
}

// Campanha agrupada por sourceID + title
export interface CampaignDetailGrouped {
  campaign_id: string;
  campaign_title: string;
  campaign_body: string;
  thumbnail_url: string;
  media_url: string;
  
  // Agregados
  total_leads: number;
  first_lead: string;
  last_lead: string;
  
  // Múltiplas fontes
  platforms: string[];
  devices: string[];
  sources: CampaignSource[];
  
  // Última frase (mais recente)
  last_greeting_message: string;
  last_source_url: string;
  
  // Agente
  cod_agent: string;
  office_name: string;
}

// Mantido para compatibilidade (deprecated)
export interface CampaignDetail {
  campaign_id: string;
  campaign_title: string;
  campaign_body: string;
  platform: string;
  source_url: string;
  media_url: string;
  thumbnail_url: string;
  conversion_source: string;
  total_leads: number;
  first_lead: string;
  last_lead: string;
  greeting_message: string;
  cod_agent: string;
  office_name: string;
}
