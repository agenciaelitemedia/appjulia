CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'meta',
  from_number text,
  message text,
  cod_agent text,
  forwarded boolean DEFAULT false,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on webhook_logs" ON public.webhook_logs
  FOR ALL TO public USING (true) WITH CHECK (true);

CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs (created_at DESC);
CREATE INDEX idx_webhook_logs_cod_agent ON public.webhook_logs (cod_agent);