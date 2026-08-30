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
          'bucket', to_char(date_trunc(CASE WHEN p_bucket = 'day' THEN 'day' ELSE 'hour' END, created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'calls', count(*),
          'errors', count(*) FILTER (WHERE status = 'error'),
          'error_rate', round((count(*) FILTER (WHERE status = 'error'))::numeric * 100 / count(*), 2),
          'p50_ms', percentile_disc(0.5) WITHIN GROUP (ORDER BY latency_ms),
          'p95_ms', percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms),
          'p99_ms', percentile_disc(0.99) WITHIN GROUP (ORDER BY latency_ms)
        ) AS p
        FROM base
        GROUP BY date_trunc(CASE WHEN p_bucket = 'day' THEN 'day' ELSE 'hour' END, created_at AT TIME ZONE 'UTC')
      ) s
    ), '[]'::jsonb)
  );
$function$;