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

export type MvpSlaStatus = 'on_track' | 'at_risk' | 'breached' | 'unknown';

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

  // SLA calculado no servidor
  sla_status: MvpSlaStatus | null;
  sla_type: 'frt' | 'nrt' | 'ttr' | null;
  sla_remaining_minutes: number | null;
  sla_target_minutes: number | null;

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

  /** Outras conversas abertas do mesmo contato (além da exibida). */
  sibling_open_count?: number;

}

export interface MvpChatCounters {
  total: number;
  pending: number;
  open: number;
  resolved: number;
  closed: number;
  unread: number;
  /** Nº de contatos (conversas líder) no escopo filtrado. */
  total_contacts?: number;
  sla_breached?: number;
  sla_at_risk?: number;
}


export interface MvpChatTimings {
  total_ms: number;
  supabase_ms: number;
  cache_ms?: number;
  external_ms: number;
  external_error: string | null;
  external_stale?: boolean;
  cache_hits?: number;
  cache_misses?: number;
  cache_refreshed?: number;
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
  /** Responsáveis (multi) — combinável com `unassigned`. */
  owners: string[];
  unassigned: boolean | null;
  search: string;
  period: 'all' | 'today' | '7d' | '30d' | 'month';
  tag_ids: string[];
  priority: string | null;
  has_ticket: boolean | null;
  has_crm_builder: boolean | null;
  /** Etapas do CRM da Júlia (multi, por id). */
  julia_stage_ids: string[];
  julia_mode: 'julia' | 'human' | null;
  has_campaign: boolean | null;
  sla_status: MvpSlaStatus[];
  sort: 'recent' | 'oldest' | 'unread' | 'sla';
  /**
   * Escopo de filas acessíveis ao usuário (mesma regra do /chat). Usado quando
   * nenhuma fila é escolhida manualmente em `queue_ids`.
   */
  scope_queue_ids?: string[];
  /** Esconde conversas adiadas (snooze) — padrão do /chat. */
  hide_snoozed?: boolean;
  /** Identidades do usuário quando ele só pode ver `open` atribuído a si. */
  restrict_open_to?: string[] | null;
}


export const DEFAULT_MVP_FILTERS: MvpChatFilters = {
  queue_ids: [],
  status: 'open',
  tab: null,
  owners: [],
  unassigned: null,
  search: '',
  period: '7d',
  tag_ids: [],
  priority: null,
  has_ticket: null,
  has_crm_builder: null,
  julia_stage_ids: [],
  julia_mode: null,
  has_campaign: null,
  sla_status: [],
  sort: 'recent',
  scope_queue_ids: [],
  hide_snoozed: true,
  restrict_open_to: null,

};
