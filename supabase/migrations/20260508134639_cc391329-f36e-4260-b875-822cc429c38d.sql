-- Habilita pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Tabela de execuções do worker
CREATE TABLE IF NOT EXISTS public.chat_return_chat_runs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at       timestamptz NOT NULL DEFAULT now(),
  trigger      text        NOT NULL DEFAULT 'cron',         -- 'cron' | 'manual'
  duration_ms  integer     NOT NULL,
  rpc_ms       integer     NOT NULL,
  candidates   integer     NOT NULL DEFAULT 0,
  processed    integer     NOT NULL DEFAULT 0,
  errors       integer     NOT NULL DEFAULT 0,
  notes        text
);

CREATE INDEX IF NOT EXISTS idx_return_chat_runs_ran_at
  ON public.chat_return_chat_runs (ran_at DESC);

ALTER TABLE public.chat_return_chat_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read return chat runs" ON public.chat_return_chat_runs;
CREATE POLICY "auth read return chat runs"
  ON public.chat_return_chat_runs
  FOR SELECT TO authenticated
  USING (true);

-- Estatísticas agregadas das execuções
CREATE OR REPLACE FUNCTION public.get_return_chat_run_stats()
RETURNS TABLE (
  window_label text,
  runs         bigint,
  candidates   bigint,
  processed    bigint,
  errors       bigint,
  avg_total_ms numeric,
  p50_total_ms numeric,
  p95_total_ms numeric,
  max_total_ms integer,
  avg_rpc_ms   numeric,
  p50_rpc_ms   numeric,
  p95_rpc_ms   numeric,
  max_rpc_ms   integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH base AS (
    SELECT
      CASE WHEN ran_at >= now() - interval '24 hours' THEN '24h' ELSE '7d' END AS w,
      duration_ms, rpc_ms, candidates, processed, errors
    FROM public.chat_return_chat_runs
    WHERE ran_at >= now() - interval '7 days'
  ),
  unioned AS (
    SELECT '24h'::text AS w, duration_ms, rpc_ms, candidates, processed, errors
    FROM public.chat_return_chat_runs
    WHERE ran_at >= now() - interval '24 hours'
    UNION ALL
    SELECT '7d'::text, duration_ms, rpc_ms, candidates, processed, errors
    FROM public.chat_return_chat_runs
    WHERE ran_at >= now() - interval '7 days'
  )
  SELECT
    w AS window_label,
    count(*)::bigint AS runs,
    COALESCE(sum(candidates),0)::bigint,
    COALESCE(sum(processed),0)::bigint,
    COALESCE(sum(errors),0)::bigint,
    round(avg(duration_ms)::numeric, 1),
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms)::numeric, 1),
    round(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::numeric, 1),
    COALESCE(max(duration_ms),0)::int,
    round(avg(rpc_ms)::numeric, 1),
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY rpc_ms)::numeric, 1),
    round(percentile_cont(0.95) WITHIN GROUP (ORDER BY rpc_ms)::numeric, 1),
    COALESCE(max(rpc_ms),0)::int
  FROM unioned
  GROUP BY w;
$$;

-- Top queries (pg_stat_statements)
CREATE OR REPLACE FUNCTION public.get_db_top_queries(limit_rows integer DEFAULT 10)
RETURNS TABLE (
  query        text,
  calls        bigint,
  total_ms     numeric,
  mean_ms      numeric,
  rows_total   bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions, pg_catalog
AS $$
  SELECT
    LEFT(regexp_replace(s.query, '\s+', ' ', 'g'), 240) AS query,
    s.calls,
    round(s.total_exec_time::numeric, 1) AS total_ms,
    round(s.mean_exec_time::numeric, 2)  AS mean_ms,
    s.rows AS rows_total
  FROM pg_stat_statements s
  WHERE s.query NOT ILIKE '%pg_stat_statements%'
    AND s.query NOT ILIKE '%information_schema%'
  ORDER BY s.mean_exec_time DESC
  LIMIT GREATEST(limit_rows, 1);
$$;

-- Cache hit ratio
CREATE OR REPLACE FUNCTION public.get_db_cache_hit_ratio()
RETURNS TABLE (
  heap_hit_ratio  numeric,
  index_hit_ratio numeric,
  measured_at     timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
  SELECT
    CASE WHEN sum(heap_blks_hit + heap_blks_read) = 0 THEN 100
         ELSE round((sum(heap_blks_hit)::numeric / NULLIF(sum(heap_blks_hit + heap_blks_read),0)) * 100, 2)
    END AS heap_hit_ratio,
    CASE WHEN sum(idx_blks_hit + idx_blks_read) = 0 THEN 100
         ELSE round((sum(idx_blks_hit)::numeric / NULLIF(sum(idx_blks_hit + idx_blks_read),0)) * 100, 2)
    END AS index_hit_ratio,
    now() AS measured_at
  FROM pg_statio_user_tables;
$$;

GRANT EXECUTE ON FUNCTION public.get_return_chat_run_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_db_top_queries(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_db_cache_hit_ratio() TO authenticated;