-- Telemetria de ambiente e performance do cliente.
-- Espelha o padrão de user_activity_log: RLS permissiva, Realtime, índices.

-- ── Snapshot de ambiente (1 linha por login) ──
CREATE TABLE IF NOT EXISTS public.user_device_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_name TEXT,
  client_id BIGINT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  browser TEXT,
  browser_version TEXT,
  os TEXT,
  os_version TEXT,
  device_type TEXT,
  cpu_cores INT,
  device_memory_gb NUMERIC,
  gpu_renderer TEXT,
  screen_w INT,
  screen_h INT,
  dpr NUMERIC,
  viewport_w INT,
  viewport_h INT,
  net_effective_type TEXT,
  net_downlink_mbps NUMERIC,
  net_rtt_ms INT,
  save_data BOOLEAN,
  language TEXT,
  timezone TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_device_log_user_occurred
  ON public.user_device_log (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_device_log_client
  ON public.user_device_log (client_id, occurred_at DESC);

ALTER TABLE public.user_device_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_device_log_all ON public.user_device_log;
CREATE POLICY user_device_log_all
  ON public.user_device_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── Métricas de performance (1 linha por carregamento/rota) ──
CREATE TABLE IF NOT EXISTS public.user_performance_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id BIGINT NOT NULL,
  client_id BIGINT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  route TEXT,
  ttfb_ms INT,
  fcp_ms INT,
  lcp_ms INT,
  cls NUMERIC,
  dom_interactive_ms INT,
  load_ms INT,
  js_heap_used_mb NUMERIC,
  net_effective_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_performance_log_client
  ON public.user_performance_log (client_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_performance_log_user
  ON public.user_performance_log (user_id, occurred_at DESC);

ALTER TABLE public.user_performance_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_performance_log_all ON public.user_performance_log;
CREATE POLICY user_performance_log_all
  ON public.user_performance_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── View: último snapshot de ambiente por usuário ──
CREATE OR REPLACE VIEW public.user_device_latest AS
SELECT DISTINCT ON (user_id) *
FROM public.user_device_log
ORDER BY user_id, occurred_at DESC;

-- ── Realtime (guard contra dupla inclusão na publicação) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_device_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_device_log;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_performance_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_performance_log;
  END IF;
END $$;
