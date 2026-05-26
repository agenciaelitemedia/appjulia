
-- ============================================================
-- Telemetria de ambiente e performance do cliente
-- ============================================================

-- 1) user_device_log: snapshot do ambiente do navegador
CREATE TABLE IF NOT EXISTS public.user_device_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  user_id         bigint NOT NULL,
  user_name       text,
  client_id       bigint,
  browser         text,
  browser_version text,
  os              text,
  os_version      text,
  device_type     text,
  cpu_cores       int,
  device_memory_gb numeric,
  gpu_renderer    text,
  screen_w        int,
  screen_h        int,
  dpr             numeric,
  viewport_w      int,
  viewport_h      int,
  net_effective_type text,
  net_downlink_mbps  numeric,
  net_rtt_ms      int,
  save_data       boolean,
  language        text,
  timezone        text,
  user_agent      text
);

GRANT SELECT, INSERT ON public.user_device_log TO authenticated;
GRANT ALL ON public.user_device_log TO service_role;

ALTER TABLE public.user_device_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth can insert device telemetry"
  ON public.user_device_log FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth can read device telemetry"
  ON public.user_device_log FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_user_device_log_user_occurred
  ON public.user_device_log (user_id, occurred_at DESC);

-- 2) user_performance_log: métricas de Web Vitals por rota
CREATE TABLE IF NOT EXISTS public.user_performance_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  user_id             bigint NOT NULL,
  client_id           bigint,
  route               text,
  ttfb_ms             int,
  fcp_ms              int,
  lcp_ms              int,
  cls                 numeric,
  dom_interactive_ms  int,
  load_ms             int,
  js_heap_used_mb     numeric,
  net_effective_type  text
);

GRANT SELECT, INSERT ON public.user_performance_log TO authenticated;
GRANT ALL ON public.user_performance_log TO service_role;

ALTER TABLE public.user_performance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth can insert performance telemetry"
  ON public.user_performance_log FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth can read performance telemetry"
  ON public.user_performance_log FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_user_perf_log_user_occurred
  ON public.user_performance_log (user_id, occurred_at DESC);

-- 3) view: último snapshot de ambiente por usuário
CREATE OR REPLACE VIEW public.user_device_latest AS
SELECT DISTINCT ON (user_id) *
FROM public.user_device_log
ORDER BY user_id, occurred_at DESC;

GRANT SELECT ON public.user_device_latest TO authenticated;
GRANT SELECT ON public.user_device_latest TO service_role;
