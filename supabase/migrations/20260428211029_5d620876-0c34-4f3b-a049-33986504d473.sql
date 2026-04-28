CREATE OR REPLACE FUNCTION public.get_infra_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_db_size_bytes bigint;
  v_active int;
  v_idle int;
  v_total int;
  v_uptime_seconds bigint;
  v_oldest_query_seconds numeric;
BEGIN
  SELECT pg_database_size(current_database()) INTO v_db_size_bytes;

  SELECT
    count(*) FILTER (WHERE state = 'active'),
    count(*) FILTER (WHERE state = 'idle'),
    count(*)
  INTO v_active, v_idle, v_total
  FROM pg_stat_activity
  WHERE datname = current_database();

  SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::bigint
    INTO v_uptime_seconds;

  SELECT COALESCE(MAX(EXTRACT(EPOCH FROM (now() - query_start))), 0)
    INTO v_oldest_query_seconds
  FROM pg_stat_activity
  WHERE state = 'active' AND query_start IS NOT NULL;

  RETURN jsonb_build_object(
    'db_size_bytes', v_db_size_bytes,
    'connections_active', v_active,
    'connections_idle', v_idle,
    'connections_total', v_total,
    'uptime_seconds', v_uptime_seconds,
    'oldest_active_query_seconds', v_oldest_query_seconds,
    'measured_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_infra_stats() TO authenticated, anon;