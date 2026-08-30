-- 1) Resumo redigido dos argumentos
ALTER TABLE public.cop_tool_calls ADD COLUMN IF NOT EXISTS arg_summary jsonb;

-- 2) Limites de alerta por escritório/tool
CREATE TABLE IF NOT EXISTS public.cop_alert_thresholds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id text NOT NULL,
  tool_name text,
  p95_limit_ms integer NOT NULL DEFAULT 4000,
  error_rate_limit numeric NOT NULL DEFAULT 10,
  min_volume integer NOT NULL DEFAULT 5,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cop_alert_thresholds_client_tool_uq
  ON public.cop_alert_thresholds (client_id, coalesce(tool_name, '*'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cop_alert_thresholds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cop_alert_thresholds TO anon;
GRANT ALL ON public.cop_alert_thresholds TO service_role;

ALTER TABLE public.cop_alert_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cop_alert_thresholds_app_access" ON public.cop_alert_thresholds;
CREATE POLICY "cop_alert_thresholds_app_access"
  ON public.cop_alert_thresholds FOR ALL
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.cop_alert_thresholds_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cop_alert_thresholds_set_updated_at ON public.cop_alert_thresholds;
CREATE TRIGGER cop_alert_thresholds_set_updated_at
  BEFORE UPDATE ON public.cop_alert_thresholds
  FOR EACH ROW EXECUTE FUNCTION public.cop_alert_thresholds_touch();

-- 3) Estatísticas com filtros, p99 e bucket configurável
DROP FUNCTION IF EXISTS public.cop_tool_call_stats(text, timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION public.cop_tool_call_stats(
  p_client_id text,
  p_from timestamptz,
  p_to timestamptz,
  p_tool text DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_mode text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_bucket text DEFAULT 'hour'
)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  WITH base AS (
    SELECT * FROM public.cop_tool_calls
    WHERE (p_client_id IS NULL OR client_id = p_client_id)
      AND created_at >= p_from
      AND created_at <= p_to
      AND (p_tool IS NULL OR tool_name = p_tool)
      AND (p_domain IS NULL OR domain = p_domain)
      AND (p_mode IS NULL OR mode = p_mode)
      AND (p_status IS NULL OR status = p_status)
  )
  SELECT jsonb_build_object(
    'window', jsonb_build_object('from', p_from, 'to', p_to, 'bucket', coalesce(p_bucket, 'hour')),
    'totals', (
      SELECT jsonb_build_object(
        'calls', count(*),
        'errors', count(*) FILTER (WHERE status = 'error'),
        'writes', count(*) FILTER (WHERE mode = 'write'),
        'error_rate', CASE WHEN count(*) = 0 THEN 0 ELSE round((count(*) FILTER (WHERE status = 'error'))::numeric * 100 / count(*), 2) END,
        'p50_ms', coalesce(percentile_disc(0.5) WITHIN GROUP (ORDER BY latency_ms), 0),
        'p95_ms', coalesce(percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms), 0),
        'p99_ms', coalesce(percentile_disc(0.99) WITHIN GROUP (ORDER BY latency_ms), 0),
        'max_ms', coalesce(max(latency_ms), 0),
        'incomplete_coverage', count(*) FILTER (WHERE coverage_complete IS FALSE)
      ) FROM base
    ),
    'by_tool', coalesce((
      SELECT jsonb_agg(t ORDER BY (t->>'calls')::int DESC) FROM (
        SELECT jsonb_build_object(
          'tool_name', tool_name,
          'domain', max(domain),
          'mode', max(mode),
          'calls', count(*),
          'errors', count(*) FILTER (WHERE status = 'error'),
          'error_rate', round((count(*) FILTER (WHERE status = 'error'))::numeric * 100 / count(*), 2),
          'p50_ms', percentile_disc(0.5) WITHIN GROUP (ORDER BY latency_ms),
          'p95_ms', percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms),
          'p99_ms', percentile_disc(0.99) WITHIN GROUP (ORDER BY latency_ms),
          'max_ms', max(latency_ms),
          'top_error', (
            SELECT coalesce(b2.error_code, 'UNKNOWN') FROM base b2
            WHERE b2.tool_name = b.tool_name AND b2.status = 'error'
            GROUP BY b2.error_code ORDER BY count(*) DESC LIMIT 1
          ),
          'top_dependency', (
            SELECT b3.dependency FROM base b3
            WHERE b3.tool_name = b.tool_name AND b3.dependency IS NOT NULL
            GROUP BY b3.dependency ORDER BY count(*) DESC LIMIT 1
          ),
          'last_call_at', max(created_at)
        ) AS t
        FROM base b GROUP BY tool_name
      ) s
    ), '[]'::jsonb),
    'by_error', coalesce((
      SELECT jsonb_agg(e ORDER BY (e->>'calls')::int DESC) FROM (
        SELECT jsonb_build_object(
          'error_code', coalesce(error_code, 'UNKNOWN'),
          'calls', count(*),
          'retryable', bool_or(retryable),
          'dependency', max(dependency),
          'last_at', max(created_at)
        ) AS e
        FROM base WHERE status = 'error' GROUP BY error_code
      ) s
    ), '[]'::jsonb),
    'timeline', coalesce((
      SELECT jsonb_agg(p ORDER BY p->>'bucket') FROM (
        SELECT jsonb_build_object(
          'bucket', to_char(date_trunc(CASE WHEN p_bucket = 'day' THEN 'day' ELSE 'hour' END, created_at), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
          'calls', count(*),
          'errors', count(*) FILTER (WHERE status = 'error'),
          'error_rate', round((count(*) FILTER (WHERE status = 'error'))::numeric * 100 / count(*), 2),
          'p50_ms', percentile_disc(0.5) WITHIN GROUP (ORDER BY latency_ms),
          'p95_ms', percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms),
          'p99_ms', percentile_disc(0.99) WITHIN GROUP (ORDER BY latency_ms)
        ) AS p
        FROM base
        GROUP BY date_trunc(CASE WHEN p_bucket = 'day' THEN 'day' ELSE 'hour' END, created_at)
      ) s
    ), '[]'::jsonb)
  );
$function$;

-- 4) Últimas chamadas com filtros e resumo redigido
DROP FUNCTION IF EXISTS public.cop_tool_call_recent(text, integer);
CREATE OR REPLACE FUNCTION public.cop_tool_call_recent(
  p_client_id text,
  p_limit integer DEFAULT 50,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_tool text DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_mode text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE(
  request_id uuid, tool_name text, domain text, tool_version text, mode text, status text,
  error_code text, retryable boolean, dependency text, latency_ms integer,
  coverage_complete boolean, coverage_warnings integer, result_count integer, dry_run boolean,
  arg_keys text[], arg_summary jsonb, created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT c.request_id, c.tool_name, c.domain, c.tool_version, c.mode, c.status,
         c.error_code, c.retryable, c.dependency, c.latency_ms,
         c.coverage_complete, c.coverage_warnings, c.result_count, c.dry_run,
         c.arg_keys, c.arg_summary, c.created_at
  FROM public.cop_tool_calls c
  WHERE (p_client_id IS NULL OR c.client_id = p_client_id)
    AND (p_from IS NULL OR c.created_at >= p_from)
    AND (p_to IS NULL OR c.created_at <= p_to)
    AND (p_tool IS NULL OR c.tool_name = p_tool)
    AND (p_domain IS NULL OR c.domain = p_domain)
    AND (p_mode IS NULL OR c.mode = p_mode)
    AND (p_status IS NULL OR c.status = p_status)
  ORDER BY c.created_at DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 50), 1), 1000);
$function$;

-- 5) Detalhe por request_id
CREATE OR REPLACE FUNCTION public.cop_tool_call_detail(
  p_client_id text,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT to_jsonb(c) - 'token_id' - 'client_id'
  FROM public.cop_tool_calls c
  WHERE c.request_id = p_request_id
    AND (p_client_id IS NULL OR c.client_id = p_client_id)
  ORDER BY c.created_at DESC
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.cop_tool_call_stats(text, timestamptz, timestamptz, text, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cop_tool_call_recent(text, integer, timestamptz, timestamptz, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cop_tool_call_detail(text, uuid) TO anon, authenticated, service_role;