CREATE TABLE public.alert_notification_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_agent text NOT NULL,
  trigger_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'notify',
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  message_template text,
  stage_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alert_notification_configs_mode_chk CHECK (mode IN ('notify','takeover')),
  CONSTRAINT alert_notification_configs_unique UNIQUE (cod_agent, trigger_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_notification_configs TO authenticated, anon;
GRANT ALL ON public.alert_notification_configs TO service_role;

ALTER TABLE public.alert_notification_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert_notification_configs_all" ON public.alert_notification_configs
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER alert_notification_configs_updated_at
  BEFORE UPDATE ON public.alert_notification_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE public.alert_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid REFERENCES public.alert_notification_configs(id) ON DELETE CASCADE,
  cod_agent text NOT NULL,
  trigger_key text NOT NULL,
  lead_phone text,
  lead_name text,
  dedupe_key text,
  recipient_phone text NOT NULL,
  message_text text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_notification_logs TO authenticated, anon;
GRANT ALL ON public.alert_notification_logs TO service_role;

ALTER TABLE public.alert_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert_notification_logs_all" ON public.alert_notification_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_alert_notification_logs_dedupe
  ON public.alert_notification_logs (cod_agent, trigger_key, dedupe_key);

CREATE INDEX idx_alert_notification_logs_created
  ON public.alert_notification_logs (cod_agent, created_at DESC);