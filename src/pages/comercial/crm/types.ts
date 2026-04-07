export interface ComercialStage {
  id: number;
  name: string;
  color: string;
  position: number;
  is_active: boolean;
}

export interface ComercialCard {
  id: number;
  stage_id: number;
  cod_agent?: string;
  contact_name: string;
  contact_phone?: string;
  contact_email?: string;
  company_name?: string;
  notes?: string;
  value?: number;
  created_by?: number;
  assigned_to?: number;
  created_at: string;
  updated_at: string;
  stage_entered_at: string;
  // Joined fields
  stage_name?: string;
  stage_color?: string;
}

export interface ComercialHistory {
  id: number;
  card_id: number;
  from_stage_id?: number;
  to_stage_id: number;
  changed_by?: number;
  changed_at: string;
  notes?: string;
  from_stage_name?: string;
  to_stage_name?: string;
}
