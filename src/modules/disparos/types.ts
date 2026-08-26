export interface DspCampaign {
  id: string;
  client_id: string;
  name: string;
  goal: string | null;
  category: string;
  channel_strategy: string;
  status: string;
  audience_filters: DspAudienceFilters;
  waba_template_name: string | null;
  waba_template_language: string | null;
  send_window_start: string | null;
  send_window_end: string | null;
  send_week_days: number[] | null;
  scheduled_at: string | null;
  timezone: string;
  schedule_start_at: string | null;
  schedule_end_at: string | null;
  auto_window_control: boolean;
  approval_status: 'draft' | 'pending' | 'approved' | 'rejected' | string;
  submitted_at: string | null;
  submitted_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  approval_notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
  pause_reason: string | null;
  risk_level: string | null;
  total_recipients: number;
  total_eligible: number;
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_replied: number;
  total_failed: number;
  total_optout: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DspAudienceFilters {
  manual_phones?: string[];
  channel_type?: string | null;
  tag_ids?: string[];
  crm_stage_ids?: string[];
  last_interaction_days?: number | null;
  only_with_conversation?: boolean;
  limit?: number | null;
}

export interface DspVariant {
  id: string;
  campaign_id: string;
  client_id: string;
  label: string;
  message_text: string | null;
  media_url: string | null;
  media_type: string | null;
  weight: number;
  is_active: boolean;
  template_id?: string | null;
}

export interface DspTemplate {
  id: string;
  client_id: string;
  name: string;
  category: string;
  body: string;
  media_url: string | null;
  media_type: string | null;
  variables: string[];
  status: 'draft' | 'pending' | 'approved' | 'rejected' | string;
  submitted_at: string | null;
  submitted_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  review_notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DspCampaignChannel {
  id: string;
  campaign_id: string;
  client_id: string;
  queue_id: string;
  weight: number;
  is_active: boolean;
}

export interface DspChannelLimits {
  id: string;
  client_id: string;
  queue_id: string;
  provider: string;
  is_enabled?: boolean;
  default_weight?: number;
  notes?: string | null;

  max_per_minute: number;
  max_per_hour: number;
  max_per_day: number;
  max_unique_recipients_per_day: number;
  min_seconds_between_messages: number;
  max_seconds_between_messages: number;
  block_size: number;
  block_pause_seconds: number;
  daily_ramp_percent: number;
  max_consecutive_failures: number;
  cooldown_after_disconnect_minutes: number;
  marketing_enabled: boolean;
  send_window_start: string | null;
  send_window_end: string | null;
}

export interface DspProviderDefaults {
  id: string;
  client_id: string;
  provider: 'uazapi' | 'meta_cloud' | string;
  max_per_minute: number;
  max_per_hour: number;
  max_per_day: number;
  max_unique_recipients_per_day: number;
  min_seconds_between_messages: number;
  max_seconds_between_messages: number;
  block_size: number;
  block_pause_seconds: number;
  daily_ramp_percent: number;
  max_consecutive_failures: number;
  cooldown_after_disconnect_minutes: number;
  marketing_enabled: boolean;
  send_window_start: string | null;
  send_window_end: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DspChannelState {
  id: string;
  client_id: string;
  queue_id: string;
  sent_in_minute: number;
  sent_in_hour: number;
  sent_in_day: number;
  unique_recipients_day: number;
  allowed_today: number | null;
  block_count: number;
  consecutive_failures: number;
  last_sent_at: string | null;
  next_allowed_at: string | null;
  cooldown_until: string | null;
  cooldown_reason: string | null;
  health_status: string;
  updated_at: string;
}

export interface DspQueueItem {
  id: string;
  campaign_id: string;
  recipient_id: string;
  status: string;
  priority: number;
  available_at: string | null;
  locked_by: string | null;
  locked_at: string | null;
  attempts: number;
  last_error: string | null;
  updated_at: string;
}

export interface DspSuppression {
  id: string;
  client_id: string;
  phone_e164: string;
  reason: string | null;
  scope: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DspAuditRow {
  id: string;
  client_id: string;
  campaign_id: string | null;
  queue_id: string | null;
  action: string;
  actor: string | null;
  details: any;
  created_at: string;
}

export interface DspSimulationResult {
  ok: boolean;
  dry_run: boolean;
  stats: {
    total: number;
    eligible: number;
    suppressed: number;
    invalid: number;
    frequency: number;
  };
  preview: { phone: string; text: string | null }[];
  capacity?: {
    daily_capacity: number;
    queues: number;
    estimated_days: number;
    estimated_minutes: number;
    blocking?: string[];
  };
}

// ------------------------------------------------------------
// Público (audiências)
// ------------------------------------------------------------
export type DspAudienceSource = 'csv' | 'manual' | 'filter';

export interface DspAudienceFilterSpec {
  channel_type?: string | null;
  queue_ids?: string[];
  tag_ids?: string[];
  cod_agents?: string[];
  contact_search?: string | null;
  only_with_conversation?: boolean;
  conversation_status?: string[];
  assigned_to?: string[];
  last_interaction_days?: number | null;
  no_reply_days?: number | null;
  crm_julia_stage_ids?: number[];
  builder_board_ids?: string[];
  builder_pipeline_ids?: string[];
  builder_status?: string[];
  campaign_ids?: string[];
  campaign_result?: 'sent' | 'replied' | 'failed' | null;
  contract_status?: string[];
  in_followup?: boolean;
  limit?: number | null;
}

export interface DspAudience {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  source: DspAudienceSource | string;
  filters: DspAudienceFilterSpec | null;
  field_map: Record<string, string> | null;
  status: 'active' | 'archived' | string;
  total_active: number;
  total_removed: number;
  last_synced_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DspAudienceContact {
  id: string;
  audience_id: string;
  client_id: string;
  phone_e164: string;
  name: string | null;
  first_name: string | null;
  email: string | null;
  document: string | null;
  extra: Record<string, any> | null;
  contact_id: string | null;
  origin: string;
  status: 'active' | 'removed' | string;
  invalid_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DspAudienceResolvePreview {
  ok: boolean;
  total: number;
  sample: { phone: string; name: string | null; contact_id: string | null }[];
}

export interface DspAudienceRefreshDiff {
  ok: boolean;
  dry_run?: boolean;
  applied?: boolean;
  resolved: number;
  current_active?: number;
  to_add?: number;
  to_remove?: number;
  to_restore?: number;
  added?: number;
  removed?: number;
  restored?: number;
  total?: number;
}
