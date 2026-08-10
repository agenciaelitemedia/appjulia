/** Tipos do módulo X-Julia. */
import type { XJStage } from './module';

export interface XJAgent {
  id: string;
  client_id: string;
  name: string;
  is_active: boolean;
  /** reception = recepciona e faz triagem; specialist = cuida de 1 caso jurídico. */
  role?: 'reception' | 'specialist';
  case_id?: string | null;
  persona: string | null;
  tone: string | null;
  system_prompt: string;
  stage_prompts: Record<string, string>;
  llm_provider: string;
  llm_model: string;
  llm_fallback_enabled: boolean;
  llm_key_mode?: string;
  voice_key_mode?: string;
  voice_enabled: boolean;
  voice_provider: string | null;
  voice_id: string | null;
  voice_settings: Record<string, any>;
  contract_provider: string;
  contract_template: string | null;
  contract_api_token?: string | null;
  business_hours: Record<string, any>;
  activation?: {
    session_start?: string;
    only_campaign?: boolean;
    start_campaign?: string;
    check_specialized?: string;
  };
  handoff_policy: Record<string, any>;
  mirror_to_crm_builder: boolean;
  max_turns: number;
  created_at: string;
  updated_at: string;
}

export interface XJLegalCase {
  id: string;
  client_id: string;
  category: string;
  name: string;
  summary: string | null;
  qualification_criteria: string | null;
  disqualification_criteria: string | null;
  required_documents: string[];
  min_ticket: number | null;
  fee_description: string | null;
  contract_template: string | null;
  contract_provider: string | null;
  contract_fields?: Array<{ key: string; label?: string; validation?: string }>;
  is_active: boolean;
  position: number;
  created_at: string;
}

export interface XJCaseQuestion {
  id: string;
  case_id: string;
  position: number;
  question: string;
  slot_key: string | null;
  answer_type: string;
  is_required: boolean;
  help_text: string | null;
}

export interface XJCaseKnowledge {
  id: string;
  case_id: string;
  title: string;
  content: string | null;
  source_type: string;
  file_url: string | null;
  file_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface XJCtaTrigger {
  id: string;
  client_id: string;
  agent_id: string | null;
  case_id: string | null;
  name: string;
  match_type: string;
  match_value: string;
  campaign_id: string | null;
  campaign_title: string | null;
  platform: string | null;
  opening_message: string | null;
  extra_prompt: string | null;
  is_active: boolean;
  priority: number;
}

export interface XJSession {
  id: string;
  client_id: string;
  agent_id: string | null;
  conversation_id: string | null;
  contact_id: string | null;
  queue_id: string | null;
  phone: string | null;
  contact_name: string | null;
  channel: string | null;
  origin: string | null;
  campaign_id: string | null;
  case_id: string | null;
  case_type: string | null;
  stage: XJStage;
  qualification: string | null;
  qualification_reason: string | null;
  score: number | null;
  slots: Record<string, any>;
  is_active: boolean;
  paused_reason: string | null;
  handoff_at: string | null;
  last_customer_message_at: string | null;
  last_agent_message_at: string | null;
  turns: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  created_at: string;
  updated_at: string;
}

export interface XJSessionEvent {
  id: string;
  session_id: string;
  kind: string;
  stage: string | null;
  skill: string | null;
  status: string;
  detail: string | null;
  payload: Record<string, any>;
  provider: string | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  duration_ms: number | null;
  created_at: string;
}

export interface XJFollowupCadence {
  id: string;
  client_id: string;
  agent_id: string;
  case_id: string | null;
  name: string;
  stage: string | null;
  is_active: boolean;
  stop_on_reply: boolean;
  on_exhausted_action: string;
  steps?: XJFollowupStep[];
}

export interface XJFollowupStep {
  id: string;
  cadence_id: string;
  position: number;
  delay_minutes: number;
  content_mode: 'fixed' | 'ai';
  content_type: string;
  text_content: string | null;
  media_url: string | null;
  media_name: string | null;
  link_url: string | null;
  generation_prompt: string | null;
  is_active: boolean;
}

export interface XJPipeline {
  id: string;
  client_id: string;
  agent_id: string | null;
  name: string;
  stage_key: string | null;
  color: string;
  position: number;
  is_active: boolean;
}

export interface XJDeal {
  id: string;
  client_id: string;
  pipeline_id: string | null;
  session_id: string | null;
  case_id: string | null;
  conversation_id: string | null;
  contact_id: string | null;
  title: string;
  contact_name: string | null;
  contact_phone: string | null;
  description: string | null;
  value: number | null;
  priority: string;
  status: string;
  origin: string | null;
  position: number;
  stage_entered_at: string;
  created_at: string;
}

export interface XJContract {
  id: string;
  client_id: string;
  session_id: string | null;
  deal_id: string | null;
  case_id: string | null;
  provider: string;
  template_id?: string | null;
  sign_url: string | null;
  document_url: string | null;
  rendered_content: string | null;
  signer_name: string | null;
  signer_document: string | null;
  signer_phone: string | null;
  value: number | null;
  status: string;
  sent_at: string | null;
  signed_at: string | null;
  created_at: string;
}

export interface XJAppointment {
  id: string;
  client_id: string;
  session_id: string | null;
  owner_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  subject: string | null;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
}

export interface XJAvailability {
  id: string;
  client_id: string;
  agent_id: string | null;
  owner_name: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  is_active: boolean;
}

export interface XJPermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}