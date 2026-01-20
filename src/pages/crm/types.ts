export interface CRMStage {
  id: number;
  name: string;
  color: string;
  position: number;
  is_active: boolean;
}

export interface CRMCard {
  id: number;
  cod_agent: string;
  contact_name: string;
  whatsapp: string;
  business_name?: string;
  stage_id: number;
  stage_name?: string;
  stage_color?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  stage_entered_at: string;
}

export interface CRMHistory {
  id: number;
  card_id: number;
  from_stage_id?: number;
  to_stage_id: number;
  changed_by?: string;
  changed_at: string;
  notes?: string;
}

export interface CRMFiltersState {
  search: string;
  stageId?: number;
  dateFrom?: string;
  dateTo?: string;
}
