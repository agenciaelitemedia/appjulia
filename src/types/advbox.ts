// Tipos para o módulo Advbox

export type ConnectionStatus = 'pending' | 'connected' | 'error';
export type NotificationStatus = 'pending' | 'sent' | 'failed';
export type SyncStatus = 'pending' | 'synced' | 'failed';
export type SendTo = 'cliente' | 'advogado' | 'ambos';
export type LeadSource = 'whatsapp_chat' | 'web_form' | 'manual';

export interface AdvboxSettings {
  auto_sync_interval?: number; // segundos (min: 300)
  enable_notifications?: boolean;
  enable_client_queries?: boolean;
  enable_lead_sync?: boolean;
}

export interface AdvboxIntegration {
  id: string;
  cod_agent: string;
  api_endpoint: string;
  api_token: string; // criptografado no banco
  is_active: boolean;
  connection_status: ConnectionStatus;
  last_sync_at: string | null;
  last_error: string | null;
  settings: AdvboxSettings;
  created_at: string;
  updated_at: string;
  // Computed fields from API
  total_processes_cached?: number;
  notifications_sent_24h?: number;
  queries_answered_24h?: number;
}

export interface AdvboxNotificationRule {
  id: string;
  cod_agent: string;
  integration_id: string;
  rule_name: string;
  is_active: boolean;
  process_phases: string[];
  event_types: string[];
  keywords: string[];
  message_template: string;
  send_to: SendTo;
  cooldown_minutes: number;
  created_at: string;
  updated_at: string;
  // Computed
  notifications_sent?: number;
  last_triggered?: string | null;
}

export interface AdvboxProcess {
  id: string;
  cod_agent: string;
  integration_id: string;
  process_id: string;
  process_number: string;
  client_id: string;
  client_name: string;
  client_phone: string;
  phase: string;
  status: string;
  responsible: string;
  last_movement_id: string;
  last_movement_date: string;
  last_movement_text: string;
  full_data: Record<string, unknown>;
  cached_at: string;
  created_at: string;
  updated_at: string;
}

export interface AdvboxNotificationLog {
  id: string;
  cod_agent: string;
  integration_id: string;
  rule_id: string | null;
  rule_name?: string;
  process_id: string;
  process_number?: string;
  recipient_phone: string;
  message_text: string;
  status: NotificationStatus;
  sent_at: string | null;
  error_message: string | null;
  whatsapp_message_id: string | null;
  whatsapp_response: Record<string, unknown> | null;
  created_at: string;
}

export interface AdvboxClientQuery {
  id: string;
  cod_agent: string;
  integration_id: string;
  client_phone: string;
  client_name: string | null;
  query_text: string;
  query_type: string;
  found_processes: number;
  response_text: string | null;
  response_sent: boolean;
  query_time_ms: number;
  created_at: string;
}

export interface AdvboxLeadSync {
  id: string;
  cod_agent: string;
  integration_id: string;
  whatsapp_number: string;
  lead_name: string;
  lead_email: string | null;
  lead_source: LeadSource;
  lead_notes: string | null;
  sync_status: SyncStatus;
  advbox_client_id: string | null;
  synced_at: string | null;
  error_message: string | null;
  retry_count: number;
  full_lead_data: Record<string, unknown> | null;
  advbox_response: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// Template variables
export type TemplateVariable = 
  | 'client_name' 
  | 'process_number' 
  | 'movement_text'
  | 'movement_date'
  | 'phase'
  | 'responsible'
  | 'law_firm_name';

export const TEMPLATE_VARIABLES: { key: TemplateVariable; label: string; placeholder: string }[] = [
  { key: 'client_name', label: 'Nome do Cliente', placeholder: '{client_name}' },
  { key: 'process_number', label: 'Número do Processo', placeholder: '{process_number}' },
  { key: 'movement_text', label: 'Texto da Movimentação', placeholder: '{movement_text}' },
  { key: 'movement_date', label: 'Data da Movimentação', placeholder: '{movement_date}' },
  { key: 'phase', label: 'Fase do Processo', placeholder: '{phase}' },
  { key: 'responsible', label: 'Responsável', placeholder: '{responsible}' },
  { key: 'law_firm_name', label: 'Nome do Escritório', placeholder: '{law_firm_name}' },
];

export const PROCESS_PHASES = [
  'Judicial',
  'Recursal',
  'Execução',
  'Consultoria',
  'Marketing',
  'Administrativo',
];

export const EVENT_TYPES = [
  'Sentença',
  'Acórdão',
  'Intimação',
  'Audiência',
  'Despacho',
  'Decisão',
  'Petição',
  'Movimentação',
];

// Form data types
export interface AdvboxIntegrationFormData {
  api_endpoint: string;
  api_token: string;
  is_active: boolean;
  settings: AdvboxSettings;
}

export interface AdvboxNotificationRuleFormData {
  rule_name: string;
  is_active: boolean;
  process_phases: string[];
  event_types: string[];
  keywords: string[];
  message_template: string;
  send_to: SendTo;
  cooldown_minutes: number;
}

// API Response types
export interface AdvboxTestConnectionResult {
  success: boolean;
  message: string;
  client_count?: number;
}

export interface AdvboxSyncResult {
  success: boolean;
  processes_synced: number;
  new_movements: number;
  errors: string[];
}
