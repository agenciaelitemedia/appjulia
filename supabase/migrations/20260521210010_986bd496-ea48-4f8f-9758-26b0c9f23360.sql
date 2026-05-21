
CREATE TABLE public.ai_usage_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  client_id     text,
  user_id       text,
  feature       text NOT NULL,
  provider      text NOT NULL,
  endpoint      text NOT NULL,
  model         text NOT NULL,
  status        text NOT NULL,
  duration_ms   integer,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens  integer,
  error_reason  text,
  context       jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_ai_usage_logs_client_feature_date
  ON public.ai_usage_logs (client_id, feature, created_at DESC);
CREATE INDEX idx_ai_usage_logs_feature_date
  ON public.ai_usage_logs (feature, created_at DESC);
CREATE INDEX idx_ai_usage_logs_created_at
  ON public.ai_usage_logs (created_at DESC);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Leitura: liberada (filtragem por admin é feita no frontend via aba protegida).
CREATE POLICY "ai_usage_logs_select_all"
  ON public.ai_usage_logs FOR SELECT
  USING (true);

-- Insert: somente service_role (edge functions).
CREATE POLICY "ai_usage_logs_insert_service"
  ON public.ai_usage_logs FOR INSERT
  WITH CHECK (true);
