
-- Table: contract_notification_configs
CREATE TABLE public.contract_notification_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_agent text NOT NULL,
  type text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  stages_count integer DEFAULT 3,
  delay_interval_minutes integer DEFAULT 1440,
  message_template text,
  target_numbers text[] DEFAULT '{}'::text[],
  trigger_event text DEFAULT 'BOTH',
  office_repeat_count integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contract_notification_configs_cod_agent ON public.contract_notification_configs(cod_agent);

ALTER TABLE public.contract_notification_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on contract_notification_configs"
  ON public.contract_notification_configs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Table: contract_notification_logs
CREATE TABLE public.contract_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid REFERENCES public.contract_notification_configs(id),
  cod_agent text,
  contract_cod_document text,
  type text,
  step_number integer DEFAULT 1,
  recipient_phone text,
  message_text text,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contract_notification_logs_cod_agent ON public.contract_notification_logs(cod_agent);
CREATE INDEX idx_contract_notification_logs_contract ON public.contract_notification_logs(contract_cod_document);

ALTER TABLE public.contract_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on contract_notification_logs"
  ON public.contract_notification_logs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
