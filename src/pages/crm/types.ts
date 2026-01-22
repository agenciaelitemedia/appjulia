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
