-- ============================================================
-- Módulo de Disparos (dsp_*)
-- ============================================================

CREATE TABLE public.dsp_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  name text NOT NULL,
  goal text,
  category text NOT NULL DEFAULT 'marketing',
  channel_strategy text NOT NULL DEFAULT 'uazapi',
  status text NOT NULL DEFAULT 'draft',
  audience_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  waba_template_name text,
  waba_template_language text,
  send_window_start time,
  send_window_end time,
  send_week_days smallint[] NOT NULL DEFAULT '{1,2,3,4,5}'::smallint[],
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  paused_at timestamptz,
  pause_reason text,
  risk_level text NOT NULL DEFAULT 'medium',
  requires_approval boolean NOT NULL DEFAULT false,
  approved_by text,
  approved_at timestamptz,
  total_recipients integer NOT NULL DEFAULT 0,
  total_eligible integer NOT NULL DEFAULT 0,
  total_sent integer NOT NULL DEFAULT 0,
  total_delivered integer NOT NULL DEFAULT 0,
  total_read integer NOT NULL DEFAULT 0,
  total_replied integer NOT NULL DEFAULT 0,
  total_failed integer NOT NULL DEFAULT 0,
  total_optout integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dsp_campaigns_client ON public.dsp_campaigns(client_id, created_at DESC);
CREATE INDEX idx_dsp_campaigns_status ON public.dsp_campaigns(status) WHERE status IN ('scheduled','preparing','running');

CREATE TABLE public.dsp_campaign_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.dsp_campaigns(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  label text,
  message_text text,
  media_url text,
  media_type text,
  file_name text,
  template_params jsonb,
  weight integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dsp_variants_campaign ON public.dsp_campaign_variants(campaign_id);

CREATE TABLE public.dsp_campaign_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.dsp_campaigns(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  queue_id uuid NOT NULL,
  weight integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, queue_id)
);

CREATE TABLE public.dsp_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.dsp_campaigns(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  contact_id uuid,
  phone_e164 text NOT NULL,
  name text,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_eligible boolean NOT NULL DEFAULT true,
  exclusion_reason text,
  variant_id uuid REFERENCES public.dsp_campaign_variants(id) ON DELETE SET NULL,
  queue_id uuid,
  channel_provider text,
  status text NOT NULL DEFAULT 'pending',
  provider_message_id text,
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  replied_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, phone_e164)
);
CREATE INDEX idx_dsp_recipients_campaign_status ON public.dsp_recipients(campaign_id, status);
CREATE INDEX idx_dsp_recipients_phone ON public.dsp_recipients(client_id, phone_e164);
CREATE INDEX idx_dsp_recipients_provider_msg ON public.dsp_recipients(provider_message_id) WHERE provider_message_id IS NOT NULL;

CREATE TABLE public.dsp_message_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.dsp_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.dsp_recipients(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL UNIQUE,
  priority smallint NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'pending',
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  locked_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dsp_queue_pick ON public.dsp_message_queue(status, available_at) WHERE status = 'pending';
CREATE INDEX idx_dsp_queue_campaign ON public.dsp_message_queue(campaign_id, status);

CREATE TABLE public.dsp_message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text,
  campaign_id uuid,
  recipient_id uuid,
  provider text NOT NULL,
  provider_message_id text,
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dsp_events_recipient ON public.dsp_message_events(recipient_id);

CREATE TABLE public.dsp_suppression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  phone_e164 text NOT NULL,
  contact_id uuid,
  reason text NOT NULL DEFAULT 'opt_out',
  scope text NOT NULL DEFAULT 'all',
  source_campaign_id uuid,
  source_message_id text,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, phone_e164)
);

CREATE TABLE public.dsp_channel_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  queue_id uuid NOT NULL,
  provider text,
  max_per_minute integer NOT NULL DEFAULT 6,
  max_per_hour integer NOT NULL DEFAULT 120,
  max_per_day integer NOT NULL DEFAULT 400,
  max_unique_recipients_per_day integer NOT NULL DEFAULT 400,
  min_seconds_between_messages integer NOT NULL DEFAULT 8,
  max_seconds_between_messages integer NOT NULL DEFAULT 25,
  block_size integer NOT NULL DEFAULT 20,
  block_pause_seconds integer NOT NULL DEFAULT 300,
  daily_ramp_percent integer NOT NULL DEFAULT 30,
  max_consecutive_failures integer NOT NULL DEFAULT 5,
  cooldown_after_disconnect_minutes integer NOT NULL DEFAULT 60,
  marketing_enabled boolean NOT NULL DEFAULT false,
  send_window_start time DEFAULT '08:00',
  send_window_end time DEFAULT '20:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (queue_id)
);

CREATE TABLE public.dsp_channel_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  queue_id uuid NOT NULL UNIQUE,
  window_minute timestamptz,
  sent_in_minute integer NOT NULL DEFAULT 0,
  window_hour timestamptz,
  sent_in_hour integer NOT NULL DEFAULT 0,
  window_day date,
  sent_in_day integer NOT NULL DEFAULT 0,
  unique_recipients_day integer NOT NULL DEFAULT 0,
  allowed_today integer,
  block_count integer NOT NULL DEFAULT 0,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_sent_at timestamptz,
  next_allowed_at timestamptz,
  cooldown_until timestamptz,
  cooldown_reason text,
  health_status text NOT NULL DEFAULT 'healthy',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dsp_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  campaign_id uuid,
  queue_id uuid,
  action text NOT NULL,
  actor text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dsp_audit_campaign ON public.dsp_audit_log(campaign_id, created_at DESC);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsp_campaigns TO authenticated, anon;
GRANT ALL ON public.dsp_campaigns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsp_campaign_variants TO authenticated, anon;
GRANT ALL ON public.dsp_campaign_variants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsp_campaign_channels TO authenticated, anon;
GRANT ALL ON public.dsp_campaign_channels TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsp_recipients TO authenticated, anon;
GRANT ALL ON public.dsp_recipients TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsp_message_queue TO authenticated, anon;
GRANT ALL ON public.dsp_message_queue TO service_role;
GRANT SELECT ON public.dsp_message_events TO authenticated, anon;
GRANT ALL ON public.dsp_message_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsp_suppression TO authenticated, anon;
GRANT ALL ON public.dsp_suppression TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsp_channel_limits TO authenticated, anon;
GRANT ALL ON public.dsp_channel_limits TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsp_channel_state TO authenticated, anon;
GRANT ALL ON public.dsp_channel_state TO service_role;
GRANT SELECT, INSERT ON public.dsp_audit_log TO authenticated, anon;
GRANT ALL ON public.dsp_audit_log TO service_role;

-- RLS (mesmo padrão permissivo das tabelas de chat; isolamento por client_id na aplicação)
ALTER TABLE public.dsp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsp_campaign_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsp_campaign_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsp_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsp_message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsp_message_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsp_suppression ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsp_channel_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsp_channel_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsp_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY dsp_campaigns_all ON public.dsp_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dsp_campaign_variants_all ON public.dsp_campaign_variants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dsp_campaign_channels_all ON public.dsp_campaign_channels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dsp_recipients_all ON public.dsp_recipients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dsp_message_queue_all ON public.dsp_message_queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dsp_message_events_read ON public.dsp_message_events FOR SELECT USING (true);
CREATE POLICY dsp_suppression_all ON public.dsp_suppression FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dsp_channel_limits_all ON public.dsp_channel_limits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dsp_channel_state_all ON public.dsp_channel_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dsp_audit_log_ins ON public.dsp_audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY dsp_audit_log_sel ON public.dsp_audit_log FOR SELECT USING (true);

-- updated_at triggers (reusa função existente do projeto)
CREATE TRIGGER trg_dsp_campaigns_updated BEFORE UPDATE ON public.dsp_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
CREATE TRIGGER trg_dsp_variants_updated BEFORE UPDATE ON public.dsp_campaign_variants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
CREATE TRIGGER trg_dsp_recipients_updated BEFORE UPDATE ON public.dsp_recipients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
CREATE TRIGGER trg_dsp_queue_updated BEFORE UPDATE ON public.dsp_message_queue FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
CREATE TRIGGER trg_dsp_limits_updated BEFORE UPDATE ON public.dsp_channel_limits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Picker atômico da fila de disparos
CREATE OR REPLACE FUNCTION public.dsp_pick_queue_items(p_worker_id text, p_limit integer DEFAULT 20)
RETURNS SETOF public.dsp_message_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT q.id
    FROM public.dsp_message_queue q
    JOIN public.dsp_campaigns c ON c.id = q.campaign_id
    WHERE q.status = 'pending'
      AND q.available_at <= now()
      AND c.status = 'running'
    ORDER BY q.priority ASC, q.available_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.dsp_message_queue q
  SET status = 'processing', locked_by = p_worker_id, locked_at = now(), updated_at = now()
  FROM picked
  WHERE q.id = picked.id
  RETURNING q.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.dsp_release_stale_locks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.dsp_message_queue
  SET status = 'pending', locked_by = NULL, locked_at = NULL, updated_at = now()
  WHERE status = 'processing' AND locked_at < now() - interval '10 minutes';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dsp_pick_queue_items(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.dsp_release_stale_locks() TO service_role;