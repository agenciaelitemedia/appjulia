// ============================================
// X-Julia (Extreme Julia) — tipos do motor
// Módulo independente: não importa nada do motor da Julia clássica.
// ============================================

export type XJStage =
  | "recepcao"
  | "triagem"
  | "qualificacao"
  | "negociacao"
  | "contrato"
  | "assinatura"
  | "agendamento"
  | "humano"
  | "encerrado";

export const XJ_STAGES: XJStage[] = [
  "recepcao",
  "triagem",
  "qualificacao",
  "negociacao",
  "contrato",
  "assinatura",
  "agendamento",
  "humano",
  "encerrado",
];

export const XJ_STAGE_LABELS: Record<XJStage, string> = {
  recepcao: "Recepção",
  triagem: "Triagem do caso",
  qualificacao: "Qualificação",
  negociacao: "Negociação",
  contrato: "Contrato",
  assinatura: "Assinatura",
  agendamento: "Agendamento",
  humano: "Atendimento humano",
  encerrado: "Encerrado",
};

export interface XJAgent {
  id: string;
  client_id: string;
  name: string;
  is_active: boolean;
  /** reception = recepcionista/roteador | specialist = especialista de um caso */
  role?: string;
  case_id?: string | null;
  persona: string | null;
  tone: string | null;
  system_prompt: string;
  stage_prompts: Record<string, string>;
  llm_provider: string;
  llm_model: string;
  llm_fallback_enabled: boolean;
  voice_enabled: boolean;
  voice_provider: string | null;
  voice_id: string | null;
  voice_settings: Record<string, unknown>;
  contract_provider: string;
  contract_template: string | null;
  business_hours: Record<string, unknown>;
  handoff_policy: Record<string, unknown>;
  mirror_to_crm_builder: boolean;
  max_turns: number;
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
  cta_trigger_id: string | null;
  case_id: string | null;
  case_type: string | null;
  stage: XJStage;
  qualification: string | null;
  qualification_reason: string | null;
  score: number | null;
  slots: Record<string, unknown>;
  is_active: boolean;
  paused_reason: string | null;
  turns: number;
  /** Quando true, o agente responde por nota de voz (skill modo_audio). */
  audio_mode?: boolean;
  audio_mode_reason?: string | null;
}

export interface XJQueueCreds {
  id: string;
  name: string;
  hub: string | null;
  evo_url: string | null;
  evo_apikey: string | null;
  waba_token: string | null;
  waba_number_id: string | null;
  channel_type: string | null;
}

export interface XJInboundMessage {
  message_id?: string | null;
  text: string;
  type: string;
  media_url?: string | null;
  mime_type?: string | null;
  file_name?: string | null;
  campaign_id?: string | null;
  campaign_title?: string | null;
  cta_payload?: string | null;
}

export interface XJRunContext {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  agent: XJAgent;
  session: XJSession;
  queue: XJQueueCreds | null;
  legalCase: XJLegalCase | null;
  inbound: XJInboundMessage;
  replies: string[];
  events: Array<Record<string, unknown>>;
  stop?: boolean;
  /** Marcado quando a sessão passa do recepcionista para o especialista do caso. */
  agentSwitched?: boolean;
  /** Marcado quando a etapa acabou de mudar para "contrato" neste mesmo turno. */
  stageChangedToContract?: boolean;
}

export interface XJLegalCase {
  id: string;
  client_id: string;
  name: string;
  category: string;
  summary: string | null;
  qualification_criteria: string | null;
  disqualification_criteria: string | null;
  required_documents: unknown[];
  min_ticket: number | null;
  fee_description: string | null;
  contract_template: string | null;
  contract_provider: string | null;
  /** Campos obrigatórios para gerar o contrato deste caso. */
  contract_fields?: Array<{ key: string; label?: string; validation?: string }> | null;
}

export interface XJChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  // deno-lint-ignore no-explicit-any
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}