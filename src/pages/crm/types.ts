export interface CRMStage {
  id: number;
  name: string;
  color: string;
  position: number;
  is_active: boolean;
}

export interface CRMCard {
  id: number;
  helena_count_id?: string;
  cod_agent: string;
  contact_name: string;
  whatsapp_number: string;
  business_name?: string;
  stage_id: number;
  stage_name?: string;
  stage_color?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  stage_entered_at: string;
  owner_name?: string;
  owner_business_name?: string;
  has_contract_history?: boolean;
}

export interface CRMAgent {
  cod_agent: string;
  owner_name: string;
  owner_business_name?: string;
  name?: string;
  role?: string;
}

export interface CRMHistory {
  id: number;
  card_id: number;
  from_stage_id?: number;
  to_stage_id: number;
  from_stage_name?: string;
  to_stage_name?: string;
  from_stage_color?: string;
  to_stage_color?: string;
  changed_by?: string;
  changed_at: string;
  notes?: string;
}

export interface CRMFiltersState {
  search: string;
  agentCodes: string[];
  dateFrom: string;
  dateTo: string;
}

// Statistics types
export interface CRMFunnelData {
  id: number;
  name: string;
  color: string;
  position: number;
  count: number;
  percentage: number;
}

export interface CRMAvgTimeData {
  id: number;
  name: string;
  color: string;
  avg_days: number;
}

export interface CRMAgentPerformance {
  cod_agent: string;
  owner_name: string;
  total_leads: number;
  converted_leads: number;
  conversion_rate: number;
  avg_time_days: number;
}

export interface CRMDailyTrend {
  date: string;
  count: number;
}

// Monitoring types
export interface CRMStuckLead extends CRMCard {
  days_stuck: number;
}

export interface CRMActivityLog {
  id: number;
  card_id: number;
  contact_name: string;
  whatsapp_number: string;
  from_stage_name?: string;
  to_stage_name?: string;
  from_stage_color?: string;
  to_stage_color?: string;
  changed_by?: string;
  changed_at: string;
  notes?: string;
}

export interface CRMAgentWorkload {
  cod_agent: string;
  owner_name: string;
  active_leads: number;
  stuck_leads: number;
}

export interface CRMStageBottleneck {
  id: number;
  name: string;
  color: string;
  count: number;
  avg_count: number;
  is_bottleneck: boolean;
}

export interface ContractInfo {
  zapsing_doctoken?: string;
  status_document: string;
  signer_name?: string;
  signer_cpf?: string;
  signer_uf?: string;
  signer_cidade?: string;
  signer_bairro?: string;
  signer_endereco?: string;
  signer_cep?: string;
  data_contrato?: string;
  data_assinatura?: string;
  cod_document?: string;
  situacao?: string;
  resumo_do_caso?: string;
  case_title?: string;
  case_category_name?: string;
  case_category_color?: string;
  cod_agent?: string;
  agent_name?: string;
  business_name?: string;
  whatsapp?: string;
}
