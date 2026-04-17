-- Sprint 9: tabelas para Integrações externas e IA avançada

-- CRM sync mappings (vincula conversa <-> deal externo)
CREATE TABLE IF NOT EXISTS public.chat_crm_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  cod_agent text,
  conversation_id uuid NOT NULL,
  contact_id uuid,
  external_system text NOT NULL DEFAULT 'crm_julia',
  external_id text NOT NULL,
  external_url text,
  sync_direction text NOT NULL DEFAULT 'both',
  last_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_crm_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_crm_links open" ON public.chat_crm_links FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_chat_crm_links_conv ON public.chat_crm_links(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_crm_links_external ON public.chat_crm_links(external_system, external_id);

-- AI classifications (inferências sobre conversas/mensagens)
CREATE TABLE IF NOT EXISTS public.chat_ai_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  cod_agent text,
  conversation_id uuid NOT NULL,
  message_id uuid,
  intent text,
  sentiment text,
  urgency text,
  topics text[] NOT NULL DEFAULT '{}',
  language text,
  confidence numeric,
  raw_response jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_ai_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_ai_classifications open" ON public.chat_ai_classifications FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ai_class_conv ON public.chat_ai_classifications(conversation_id, created_at DESC);

-- AI auto-reply rules (auto-responder baseado em IA + KB)
CREATE TABLE IF NOT EXISTS public.chat_ai_autoreply_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  cod_agent text,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT false,
  match_intents text[] NOT NULL DEFAULT '{}',
  match_keywords text[] NOT NULL DEFAULT '{}',
  use_knowledge_base boolean NOT NULL DEFAULT true,
  kb_category_id uuid,
  system_prompt text,
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  max_replies_per_conversation integer NOT NULL DEFAULT 3,
  handoff_after_max boolean NOT NULL DEFAULT true,
  only_business_hours boolean NOT NULL DEFAULT false,
  confidence_threshold numeric NOT NULL DEFAULT 0.6,
  position integer NOT NULL DEFAULT 0,
  execution_count integer NOT NULL DEFAULT 0,
  last_executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_ai_autoreply_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_ai_autoreply_rules open" ON public.chat_ai_autoreply_rules FOR ALL USING (true) WITH CHECK (true);

-- AI auto-reply log
CREATE TABLE IF NOT EXISTS public.chat_ai_autoreply_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  rule_id uuid,
  conversation_id uuid NOT NULL,
  message_id uuid,
  generated_text text,
  sent boolean NOT NULL DEFAULT false,
  confidence numeric,
  used_kb_articles uuid[],
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_ai_autoreply_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_ai_autoreply_logs open" ON public.chat_ai_autoreply_logs FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ai_autoreply_logs_conv ON public.chat_ai_autoreply_logs(conversation_id, created_at DESC);

-- Daily report snapshots (cache para dashboards de analytics)
CREATE TABLE IF NOT EXISTS public.chat_analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  cod_agent text,
  date date NOT NULL,
  total_conversations integer NOT NULL DEFAULT 0,
  new_conversations integer NOT NULL DEFAULT 0,
  resolved_conversations integer NOT NULL DEFAULT 0,
  total_messages integer NOT NULL DEFAULT 0,
  inbound_messages integer NOT NULL DEFAULT 0,
  outbound_messages integer NOT NULL DEFAULT 0,
  avg_first_response_seconds integer,
  avg_resolution_seconds integer,
  sla_compliance_pct numeric,
  csat_avg numeric,
  csat_responses integer NOT NULL DEFAULT 0,
  by_channel jsonb NOT NULL DEFAULT '{}'::jsonb,
  by_agent jsonb NOT NULL DEFAULT '{}'::jsonb,
  by_tag jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, cod_agent, date)
);
ALTER TABLE public.chat_analytics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_analytics_daily open" ON public.chat_analytics_daily FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON public.chat_analytics_daily(client_id, date DESC);