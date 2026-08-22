/** Tipos do feed consolidado do MVP Chat. */

export interface MvpChatTag {
  id: string;
  name: string;
  color: string;
}

export interface MvpChatCampaign {
  id: string | number;
  created_at?: string | null;
  campaign_data?: Record<string, any> | null;
}

/** Uma linha = um card da lista, já 100% hidratado pelo servidor. */
export interface MvpChatRowData {
  // contato
  contact_id: string;
  contact_name: string | null;
  phone: string | null;
  avatar: string | null;
  avatar_storage_path: string | null;
  is_group: boolean;
  unread_count: number;
  last_message_at: string | null;
  last_message_text: string | null;
  channel_source: string | null;
  channel_type: string | null;
  lead_full_name: string | null;

  // conversa líder
  conversation_id: string;
  queue_id: string | null;
  queue_name: string | null;
  queue_is_active: boolean | null;
  channel: string | null;
  status: 'pending' | 'open' | 'resolved' | 'closed';
  protocol: string | null;
  assigned_to: string | null;
  assigned_user_id: number | null;
  priority: string;
  opened_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  snoozed_until: string | null;
  snooze_reason: string | null;
  last_customer_message_at: string | null;
  last_message_from_me: boolean | null;
  conversation_updated_at: string;

  // etiquetas
  tags: MvpChatTag[];

  // ticket de suporte
  active_ticket_id: string | null;
  active_ticket_number: number | null;
  active_ticket_protocol: string | null;
  ticket_status: string | null;
  ticket_priority: string | null;
  ticket_subject: string | null;

  // CRM Builder
  crm_board_name: string | null;
  crm_board_color: string | null;
  crm_pipeline_name: string | null;
  crm_pipeline_color: string | null;

  // banco legado (CRM da Júlia / sessão / Meta Ads)
  queue_cod_agent: string | null;
  phone_key: string | null;
  julia_stage_id: number | string | null;
  julia_stage_name: string | null;
  julia_stage_color: string | null;
  has_julia_card: boolean;
  session_is_active: boolean | null;
  campaign: MvpChatCampaign | null;
}

export interface MvpChatCounters {
  total: number;
  pending: number;
  open: number;
  resolved: number;
  closed: number;
  unread: number;
}

export interface MvpChatTimings {
  total_ms: number;
  supabase_ms: number;
  external_ms: number;
  external_error: string | null;
  sql_count: number;
  rows: number;
}

export interface MvpChatFeedResponse {
  rows: MvpChatRowData[];
  counters: MvpChatCounters;
  has_more: boolean;
  timings: MvpChatTimings;
}

export type MvpChatTab = 'pending' | 'open' | 'resolved_closed' | null;

export interface MvpChatFilters {
  queue_ids: string[];
  status: MvpChatTab;
  tab: 'individual' | 'groups' | null;
  owner: string | null;
  unassigned: boolean | null;
  search: string;
  period: 'all' | 'today' | '7d' | '30d' | 'month';
  tag_ids: string[];
  priority: string | null;
  has_ticket: boolean | null;
  has_crm_builder: boolean | null;
  julia_stage: string | null;
  julia_mode: 'julia' | 'human' | null;
  has_campaign: boolean | null;
  sort: 'recent' | 'oldest' | 'unread';
}

export const DEFAULT_MVP_FILTERS: MvpChatFilters = {
  queue_ids: [],
  status: null,
  tab: null,
  owner: null,
  unassigned: null,
  search: '',
  period: 'all',
  tag_ids: [],
  priority: null,
  has_ticket: null,
  has_crm_builder: null,
  julia_stage: null,
  julia_mode: null,
  has_campaign: null,
  sort: 'recent',
};
