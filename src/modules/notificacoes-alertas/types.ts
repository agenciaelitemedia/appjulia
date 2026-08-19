import type { AlertMode, AlertTriggerKey } from './module';

export interface AlertConfig {
  id: string;
  cod_agent: string;
  trigger_key: AlertTriggerKey;
  is_active: boolean;
  mode: AlertMode;
  recipients: string[];
  message_template: string | null;
  stage_ids: string[];
  no_response_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface AlertConfigInput {
  cod_agent: string;
  trigger_key: AlertTriggerKey;
  is_active?: boolean;
  mode?: AlertMode;
  recipients?: string[];
  message_template?: string | null;
  stage_ids?: string[];
  no_response_minutes?: number;
}

export interface AlertLog {
  id: string;
  cod_agent: string;
  trigger_key: string;
  lead_phone: string | null;
  lead_name: string | null;
  recipient_phone: string;
  message_text: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface AlertCrmStage {
  id: string;
  name: string;
  color?: string | null;
}

export interface AlertHistoryEntry {
  id: string;
  client_id: string | null;
  cod_agent: string;
  config_id: string | null;
  trigger_key: string;
  lead_phone: string | null;
  lead_name: string | null;
  recipient_phone: string;
  message_text: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface AlertHistoryFilters {
  clientId?: string;
  codAgent?: string;
  triggerKey?: string;
  status?: string;
  search?: string;
}
