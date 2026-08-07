-- ============================================================
-- X-Julia (Extreme Julia) — base de dados do módulo
-- ============================================================

CREATE OR REPLACE FUNCTION public.xj_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ----------------------------------------------------------
-- 1. Agentes
-- ----------------------------------------------------------
CREATE TABLE public.xj_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  persona text,
  tone text,
  system_prompt text NOT NULL DEFAULT '',
  stage_prompts jsonb NOT NULL DEFAULT '{}'::jsonb,
  llm_provider text NOT NULL DEFAULT 'lovable',
  llm_model text NOT NULL DEFAULT 'google/gemini-3.6-flash',
  llm_fallback_enabled boolean NOT NULL DEFAULT true,
  voice_enabled boolean NOT NULL DEFAULT false,
  voice_provider text DEFAULT 'elevenlabs',
  voice_id text,
  voice_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  contract_provider text NOT NULL DEFAULT 'zapsign',
  contract_template text,
  business_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  handoff_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  mirror_to_crm_builder boolean NOT NULL DEFAULT false,
  max_turns integer NOT NULL DEFAULT 60,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_agents TO authenticated, anon;
GRANT ALL ON public.xj_agents TO service_role;
ALTER TABLE public.xj_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_agents_app_access ON public.xj_agents FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_xj_agents_touch BEFORE UPDATE ON public.xj_agents
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();
CREATE INDEX idx_xj_agents_client ON public.xj_agents (client_id);

-- ----------------------------------------------------------
-- 2. Versões de prompt
-- ----------------------------------------------------------
CREATE TABLE public.xj_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.xj_agents(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  label text,
  system_prompt text NOT NULL DEFAULT '',
  stage_prompts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_prompt_versions TO authenticated, anon;
GRANT ALL ON public.xj_prompt_versions TO service_role;
ALTER TABLE public.xj_prompt_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_prompt_versions_app_access ON public.xj_prompt_versions FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_xj_prompt_versions_agent ON public.xj_prompt_versions (agent_id, version DESC);

-- ----------------------------------------------------------
-- 3. Biblioteca de casos (exclusiva do módulo)
-- ----------------------------------------------------------
CREATE TABLE public.xj_legal_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  category text NOT NULL DEFAULT 'Geral',
  name text NOT NULL,
  slug text,
  summary text,
  qualification_criteria text,
  disqualification_criteria text,
  required_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  min_ticket numeric,
  fee_description text,
  contract_template text,
  contract_provider text,
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_legal_cases TO authenticated, anon;
GRANT ALL ON public.xj_legal_cases TO service_role;
ALTER TABLE public.xj_legal_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_legal_cases_app_access ON public.xj_legal_cases FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_xj_legal_cases_touch BEFORE UPDATE ON public.xj_legal_cases
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();
CREATE INDEX idx_xj_legal_cases_client ON public.xj_legal_cases (client_id, category, position);

CREATE TABLE public.xj_case_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  case_id uuid NOT NULL REFERENCES public.xj_legal_cases(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  question text NOT NULL,
  slot_key text,
  answer_type text NOT NULL DEFAULT 'text',
  is_required boolean NOT NULL DEFAULT true,
  help_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_case_questions TO authenticated, anon;
GRANT ALL ON public.xj_case_questions TO service_role;
ALTER TABLE public.xj_case_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_case_questions_app_access ON public.xj_case_questions FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_xj_case_questions_touch BEFORE UPDATE ON public.xj_case_questions
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();
CREATE INDEX idx_xj_case_questions_case ON public.xj_case_questions (case_id, position);

CREATE TABLE public.xj_case_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  case_id uuid NOT NULL REFERENCES public.xj_legal_cases(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  source_type text NOT NULL DEFAULT 'text',
  file_url text,
  file_name text,
  mime_type text,
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_case_knowledge TO authenticated, anon;
GRANT ALL ON public.xj_case_knowledge TO service_role;
ALTER TABLE public.xj_case_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_case_knowledge_app_access ON public.xj_case_knowledge FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_xj_case_knowledge_touch BEFORE UPDATE ON public.xj_case_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();
CREATE INDEX idx_xj_case_knowledge_case ON public.xj_case_knowledge (case_id);

-- ----------------------------------------------------------
-- 4. Gatilhos de CTA (campanhas ads)
-- ----------------------------------------------------------
CREATE TABLE public.xj_cta_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  agent_id uuid REFERENCES public.xj_agents(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.xj_legal_cases(id) ON DELETE SET NULL,
  name text NOT NULL,
  match_type text NOT NULL DEFAULT 'contains',
  match_value text NOT NULL,
  campaign_id text,
  campaign_title text,
  platform text,
  opening_message text,
  extra_prompt text,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_cta_triggers TO authenticated, anon;
GRANT ALL ON public.xj_cta_triggers TO service_role;
ALTER TABLE public.xj_cta_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_cta_triggers_app_access ON public.xj_cta_triggers FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_xj_cta_triggers_touch BEFORE UPDATE ON public.xj_cta_triggers
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();
CREATE INDEX idx_xj_cta_triggers_client ON public.xj_cta_triggers (client_id, is_active, priority DESC);

-- ----------------------------------------------------------
-- 5. Vínculo fila ↔ agente
-- ----------------------------------------------------------
CREATE TABLE public.xj_agent_queue_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.xj_agents(id) ON DELETE CASCADE,
  queue_id uuid NOT NULL,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, queue_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_agent_queue_links TO authenticated, anon;
GRANT ALL ON public.xj_agent_queue_links TO service_role;
ALTER TABLE public.xj_agent_queue_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_agent_queue_links_app_access ON public.xj_agent_queue_links FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_xj_agent_queue_links_queue ON public.xj_agent_queue_links (queue_id);

-- ----------------------------------------------------------
-- 6. Sessões e trilha
-- ----------------------------------------------------------
CREATE TABLE public.xj_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  agent_id uuid REFERENCES public.xj_agents(id) ON DELETE SET NULL,
  conversation_id uuid,
  contact_id uuid,
  queue_id uuid,
  phone text,
  contact_name text,
  channel text,
  origin text,
  campaign_id text,
  cta_trigger_id uuid REFERENCES public.xj_cta_triggers(id) ON DELETE SET NULL,
  case_id uuid REFERENCES public.xj_legal_cases(id) ON DELETE SET NULL,
  case_type text,
  stage text NOT NULL DEFAULT 'recepcao',
  qualification text,
  qualification_reason text,
  score numeric,
  slots jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  paused_reason text,
  handoff_at timestamptz,
  last_customer_message_at timestamptz,
  last_agent_message_at timestamptz,
  turns integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_sessions TO authenticated, anon;
GRANT ALL ON public.xj_sessions TO service_role;
ALTER TABLE public.xj_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_sessions_app_access ON public.xj_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_xj_sessions_touch BEFORE UPDATE ON public.xj_sessions
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();
CREATE UNIQUE INDEX idx_xj_sessions_conversation ON public.xj_sessions (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_xj_sessions_client_stage ON public.xj_sessions (client_id, stage);
CREATE INDEX idx_xj_sessions_phone ON public.xj_sessions (client_id, phone);

CREATE TABLE public.xj_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  session_id uuid NOT NULL REFERENCES public.xj_sessions(id) ON DELETE CASCADE,
  kind text NOT NULL,
  stage text,
  skill text,
  status text NOT NULL DEFAULT 'ok',
  detail text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider text,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  cost numeric,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_session_events TO authenticated, anon;
GRANT ALL ON public.xj_session_events TO service_role;
ALTER TABLE public.xj_session_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_session_events_app_access ON public.xj_session_events FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_xj_session_events_session ON public.xj_session_events (session_id, created_at DESC);
CREATE INDEX idx_xj_session_events_client ON public.xj_session_events (client_id, created_at DESC);

-- ----------------------------------------------------------
-- 7. Followup configurável
-- ----------------------------------------------------------
CREATE TABLE public.xj_followup_cadences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.xj_agents(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.xj_legal_cases(id) ON DELETE CASCADE,
  name text NOT NULL,
  stage text,
  is_active boolean NOT NULL DEFAULT true,
  stop_on_reply boolean NOT NULL DEFAULT true,
  on_exhausted_action text NOT NULL DEFAULT 'mark_no_reply',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_followup_cadences TO authenticated, anon;
GRANT ALL ON public.xj_followup_cadences TO service_role;
ALTER TABLE public.xj_followup_cadences ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_followup_cadences_app_access ON public.xj_followup_cadences FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_xj_followup_cadences_touch BEFORE UPDATE ON public.xj_followup_cadences
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();
CREATE INDEX idx_xj_followup_cadences_agent ON public.xj_followup_cadences (agent_id, stage, is_active);

CREATE TABLE public.xj_followup_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  cadence_id uuid NOT NULL REFERENCES public.xj_followup_cadences(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  delay_minutes integer NOT NULL DEFAULT 120,
  content_mode text NOT NULL DEFAULT 'fixed',
  content_type text NOT NULL DEFAULT 'text',
  text_content text,
  media_url text,
  media_name text,
  mime_type text,
  link_url text,
  generation_prompt text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_followup_steps TO authenticated, anon;
GRANT ALL ON public.xj_followup_steps TO service_role;
ALTER TABLE public.xj_followup_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_followup_steps_app_access ON public.xj_followup_steps FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_xj_followup_steps_touch BEFORE UPDATE ON public.xj_followup_steps
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();
CREATE INDEX idx_xj_followup_steps_cadence ON public.xj_followup_steps (cadence_id, position);

CREATE TABLE public.xj_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  session_id uuid NOT NULL REFERENCES public.xj_sessions(id) ON DELETE CASCADE,
  cadence_id uuid REFERENCES public.xj_followup_cadences(id) ON DELETE SET NULL,
  step_id uuid REFERENCES public.xj_followup_steps(id) ON DELETE SET NULL,
  attempt integer NOT NULL DEFAULT 1,
  run_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  error_message text,
  resolved_content jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_followups TO authenticated, anon;
GRANT ALL ON public.xj_followups TO service_role;
ALTER TABLE public.xj_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_followups_app_access ON public.xj_followups FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_xj_followups_touch BEFORE UPDATE ON public.xj_followups
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();
CREATE INDEX idx_xj_followups_due ON public.xj_followups (status, run_at);
CREATE INDEX idx_xj_followups_session ON public.xj_followups (session_id, status);

-- ----------------------------------------------------------
-- 8. CRM próprio
-- ----------------------------------------------------------
CREATE TABLE public.xj_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  agent_id uuid REFERENCES public.xj_agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  stage_key text,
  color text NOT NULL DEFAULT '#a855f7',
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_pipelines TO authenticated, anon;
GRANT ALL ON public.xj_pipelines TO service_role;
ALTER TABLE public.xj_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_pipelines_app_access ON public.xj_pipelines FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_xj_pipelines_touch BEFORE UPDATE ON public.xj_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();
CREATE INDEX idx_xj_pipelines_client ON public.xj_pipelines (client_id, position);

CREATE TABLE public.xj_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  agent_id uuid REFERENCES public.xj_agents(id) ON DELETE SET NULL,
  pipeline_id uuid REFERENCES public.xj_pipelines(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.xj_sessions(id) ON DELETE SET NULL,
  case_id uuid REFERENCES public.xj_legal_cases(id) ON DELETE SET NULL,
  conversation_id uuid,
  contact_id uuid,
  title text NOT NULL,
  contact_name text,
  contact_phone text,
  description text,
  value numeric,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  assigned_to text,
  campaign_id text,
  origin text,
  position integer NOT NULL DEFAULT 0,
  stage_entered_at timestamptz NOT NULL DEFAULT now(),
  mirrored_deal_id uuid,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_deals TO authenticated, anon;
GRANT ALL ON public.xj_deals TO service_role;
ALTER TABLE public.xj_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_deals_app_access ON public.xj_deals FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_xj_deals_touch BEFORE UPDATE ON public.xj_deals
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();
CREATE INDEX idx_xj_deals_client_pipeline ON public.xj_deals (client_id, pipeline_id, position);
CREATE INDEX idx_xj_deals_session ON public.xj_deals (session_id);
CREATE INDEX idx_xj_deals_phone ON public.xj_deals (client_id, contact_phone);

CREATE TABLE public.xj_deal_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.xj_deals(id) ON DELETE CASCADE,
  from_pipeline_id uuid REFERENCES public.xj_pipelines(id) ON DELETE SET NULL,
  to_pipeline_id uuid REFERENCES public.xj_pipelines(id) ON DELETE SET NULL,
  action text NOT NULL DEFAULT 'moved',
  notes text,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_deal_history TO authenticated, anon;
GRANT ALL ON public.xj_deal_history TO service_role;
ALTER TABLE public.xj_deal_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_deal_history_app_access ON public.xj_deal_history FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_xj_deal_history_deal ON public.xj_deal_history (deal_id, created_at DESC);

-- ----------------------------------------------------------
-- 9. Contratos
-- ----------------------------------------------------------
CREATE TABLE public.xj_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  session_id uuid REFERENCES public.xj_sessions(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.xj_deals(id) ON DELETE SET NULL,
  case_id uuid REFERENCES public.xj_legal_cases(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'internal',
  external_id text,
  template text,
  rendered_content text,
  document_url text,
  sign_url text,
  signer_name text,
  signer_document text,
  signer_phone text,
  value numeric,
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  signed_at timestamptz,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_contracts TO authenticated, anon;
GRANT ALL ON public.xj_contracts TO service_role;
ALTER TABLE public.xj_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_contracts_app_access ON public.xj_contracts FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_xj_contracts_touch BEFORE UPDATE ON public.xj_contracts
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();
CREATE INDEX idx_xj_contracts_session ON public.xj_contracts (session_id);
CREATE INDEX idx_xj_contracts_status ON public.xj_contracts (client_id, status);

-- ----------------------------------------------------------
-- 10. Agenda interna
-- ----------------------------------------------------------
CREATE TABLE public.xj_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  agent_id uuid REFERENCES public.xj_agents(id) ON DELETE CASCADE,
  owner_user_id text,
  owner_name text,
  weekday smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_minutes integer NOT NULL DEFAULT 30,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_availability TO authenticated, anon;
GRANT ALL ON public.xj_availability TO service_role;
ALTER TABLE public.xj_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_availability_app_access ON public.xj_availability FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_xj_availability_touch BEFORE UPDATE ON public.xj_availability
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();
CREATE INDEX idx_xj_availability_client ON public.xj_availability (client_id, weekday);

CREATE TABLE public.xj_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  agent_id uuid REFERENCES public.xj_agents(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.xj_sessions(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.xj_deals(id) ON DELETE SET NULL,
  owner_user_id text,
  owner_name text,
  contact_name text,
  contact_phone text,
  subject text,
  notes text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  provider text NOT NULL DEFAULT 'internal',
  external_id text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_appointments TO authenticated, anon;
GRANT ALL ON public.xj_appointments TO service_role;
ALTER TABLE public.xj_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_appointments_app_access ON public.xj_appointments FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_xj_appointments_touch BEFORE UPDATE ON public.xj_appointments
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();
CREATE INDEX idx_xj_appointments_slot ON public.xj_appointments (client_id, starts_at);

-- ----------------------------------------------------------
-- 11. Skills
-- ----------------------------------------------------------
CREATE TABLE public.xj_skill_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.xj_agents(id) ON DELETE CASCADE,
  skill text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, skill)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_skill_configs TO authenticated, anon;
GRANT ALL ON public.xj_skill_configs TO service_role;
ALTER TABLE public.xj_skill_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY xj_skill_configs_app_access ON public.xj_skill_configs FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_xj_skill_configs_touch BEFORE UPDATE ON public.xj_skill_configs
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();