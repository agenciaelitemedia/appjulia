
-- ===== TELEFONIA NO CHAT =====
CREATE TABLE public.chat_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  cod_agent text,
  conversation_id uuid,
  contact_id uuid,
  agent_identifier text,
  direction text NOT NULL DEFAULT 'outbound',
  status text NOT NULL DEFAULT 'initiated',
  provider text,
  external_call_id text,
  from_number text,
  to_number text,
  started_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  recording_url text,
  transcription text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_call_logs open" ON public.chat_call_logs FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_chat_call_logs_conv ON public.chat_call_logs(conversation_id);
CREATE INDEX idx_chat_call_logs_client ON public.chat_call_logs(client_id, started_at DESC);

-- ===== MARKETING: VARIANTES A/B =====
CREATE TABLE public.chat_campaign_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  label text NOT NULL,
  message_text text NOT NULL,
  media_type text,
  media_url text,
  weight integer NOT NULL DEFAULT 50,
  contacts_sent integer NOT NULL DEFAULT 0,
  contacts_delivered integer NOT NULL DEFAULT 0,
  contacts_replied integer NOT NULL DEFAULT 0,
  contacts_converted integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_campaign_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_campaign_variants open" ON public.chat_campaign_variants FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_variants_campaign ON public.chat_campaign_variants(campaign_id);

-- Adicionar variant_id em recipients
ALTER TABLE public.chat_campaign_recipients
  ADD COLUMN IF NOT EXISTS variant_id uuid,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

-- ===== MARKETING: AGENDAMENTO RECORRENTE =====
CREATE TABLE public.chat_campaign_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  client_id text NOT NULL,
  cron_expression text,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  is_active boolean NOT NULL DEFAULT true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  run_count integer NOT NULL DEFAULT 0,
  max_runs integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_campaign_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_campaign_schedules open" ON public.chat_campaign_schedules FOR ALL USING (true) WITH CHECK (true);

-- ===== SEGURANÇA: AUDITORIA =====
CREATE TABLE public.chat_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  cod_agent text,
  actor_identifier text,
  actor_name text,
  actor_ip text,
  user_agent text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_audit_log open" ON public.chat_audit_log FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_audit_client_date ON public.chat_audit_log(client_id, created_at DESC);
CREATE INDEX idx_audit_resource ON public.chat_audit_log(resource_type, resource_id);

-- ===== SEGURANÇA: LGPD =====
CREATE TABLE public.chat_lgpd_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  cod_agent text,
  contact_id uuid,
  contact_phone text,
  request_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_by text,
  reason text,
  result_url text,
  processed_at timestamptz,
  processed_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_lgpd_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_lgpd_requests open" ON public.chat_lgpd_requests FOR ALL USING (true) WITH CHECK (true);

-- ===== SEGURANÇA: PERMISSÕES POR PAPEL =====
CREATE TABLE public.chat_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  role_name text NOT NULL,
  description text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, role_name)
);
ALTER TABLE public.chat_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_role_permissions open" ON public.chat_role_permissions FOR ALL USING (true) WITH CHECK (true);

-- ===== SEGURANÇA: 2FA OPCIONAL =====
CREATE TABLE public.chat_user_security (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_identifier text NOT NULL UNIQUE,
  totp_secret text,
  totp_enabled boolean NOT NULL DEFAULT false,
  totp_verified_at timestamptz,
  backup_codes jsonb,
  last_login_at timestamptz,
  last_login_ip text,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_user_security ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_user_security open" ON public.chat_user_security FOR ALL USING (true) WITH CHECK (true);
