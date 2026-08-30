CREATE TABLE public.cop_tool_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL,
  tool_name text NOT NULL,
  domain text,
  tool_version text,
  mode text NOT NULL DEFAULT 'read',
  client_id text,
  token_id text,
  status text NOT NULL DEFAULT 'ok',
  error_code text,
  retryable boolean NOT NULL DEFAULT false,
  dependency text,
  latency_ms integer NOT NULL DEFAULT 0,
  dry_run boolean,
  coverage_complete boolean,
  coverage_warnings integer NOT NULL DEFAULT 0,
  result_count integer,
  arg_keys text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.cop_tool_calls TO service_role;
ALTER TABLE public.cop_tool_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cop_tool_calls service only" ON public.cop_tool_calls FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_cop_tool_calls_client_created ON public.cop_tool_calls (client_id, created_at DESC);
CREATE INDEX idx_cop_tool_calls_tool_created ON public.cop_tool_calls (tool_name, created_at DESC);
CREATE INDEX idx_cop_tool_calls_request ON public.cop_tool_calls (request_id);

CREATE OR REPLACE FUNCTION public.cop_tool_call_stats(
  p_client_id text,
  p_from timestamp with time zone,
  p_to timestamp with time zone
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT * FROM public.cop_tool_calls
    WHERE (p_client_id IS NULL OR client_id = p_client_id)
      AND created_at >= p_from
      AND created_at <= p_to
  )
  SELECT jsonb_build_object(
    'window', jsonb_build_object('from', p_from, 'to', p_to),
    'totals', (
      SELECT jsonb_build_object(
        'calls', count(*),
        'errors', count(*) FILTER (WHERE status = 'error'),
        'writes', count(*) FILTER (WHERE mode = 'write'),
        'error_rate', CASE WHEN count(*) = 0 THEN 0 ELSE round((count(*) FILTER (WHERE status = 'error'))::numeric * 100 / count(*), 2) END,
        'p50_ms', coalesce(percentile_disc(0.5) WITHIN GROUP (ORDER BY latency_ms), 0),
        'p95_ms', coalesce(percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms), 0),
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
          'max_ms', max(latency_ms),
          'last_call_at', max(created_at)
        ) AS t
        FROM base GROUP BY tool_name
      ) s
    ), '[]'::jsonb),
    'by_error', coalesce((
      SELECT jsonb_agg(e ORDER BY (e->>'calls')::int DESC) FROM (
        SELECT jsonb_build_object(
          'error_code', coalesce(error_code, 'UNKNOWN'),
          'calls', count(*),
          'retryable', bool_or(retryable),
          'last_at', max(created_at)
        ) AS e
        FROM base WHERE status = 'error' GROUP BY error_code
      ) s
    ), '[]'::jsonb),
    'timeline', coalesce((
      SELECT jsonb_agg(b ORDER BY (b->>'bucket')) FROM (
        SELECT jsonb_build_object(
          'bucket', to_char(bucket, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
          'calls', calls,
          'errors', errors,
          'p95_ms', p95
        ) AS b
        FROM (
          SELECT
            CASE WHEN p_to - p_from > interval '2 days'
              THEN date_trunc('day', created_at)
              ELSE date_trunc('hour', created_at) END AS bucket,
            count(*) AS calls,
            count(*) FILTER (WHERE status = 'error') AS errors,
            percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
          FROM base
          GROUP BY 1
        ) g
      ) s
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.cop_tool_call_recent(
  p_client_id text,
  p_limit integer DEFAULT 50
) RETURNS TABLE (
  request_id uuid,
  tool_name text,
  domain text,
  mode text,
  status text,
  error_code text,
  dependency text,
  latency_ms integer,
  coverage_complete boolean,
  coverage_warnings integer,
  result_count integer,
  dry_run boolean,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.request_id, c.tool_name, c.domain, c.mode, c.status, c.error_code, c.dependency,
         c.latency_ms, c.coverage_complete, c.coverage_warnings, c.result_count, c.dry_run, c.created_at
  FROM public.cop_tool_calls c
  WHERE (p_client_id IS NULL OR c.client_id = p_client_id)
  ORDER BY c.created_at DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 50), 1), 200);
$$;

CREATE OR REPLACE FUNCTION public.cop_tool_calls_cleanup(p_retention_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.cop_tool_calls
  WHERE created_at < now() - make_interval(days => GREATEST(coalesce(p_retention_days, 30), 1));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cop_tool_call_stats(text, timestamp with time zone, timestamp with time zone) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cop_tool_call_recent(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cop_tool_calls_cleanup(integer) TO service_role;