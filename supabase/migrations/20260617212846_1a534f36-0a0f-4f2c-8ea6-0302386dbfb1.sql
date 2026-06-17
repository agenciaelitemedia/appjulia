CREATE OR REPLACE FUNCTION public.rollup_user_presence_daily(p_day date DEFAULT (((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date - 1))
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_from timestamptz := (p_day::timestamp AT TIME ZONE 'America/Sao_Paulo');
  v_to   timestamptz := ((p_day + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo');
  v_rows integer;
BEGIN
  WITH src AS (
    SELECT
      user_id,
      seen_at,
      LAG(seen_at) OVER (PARTITION BY user_id ORDER BY seen_at) AS prev_at
    FROM public.user_presence_heartbeats
    WHERE seen_at >= v_from AND seen_at < v_to
  ),
  agg AS (
    SELECT
      user_id,
      count(*) * 30 AS online_seconds,
      1 + count(*) FILTER (WHERE prev_at IS NOT NULL
                             AND seen_at - prev_at > interval '2 minutes') AS sessions_count
    FROM src
    GROUP BY user_id
  ),
  -- pega 1 client_id por user (o mais frequente no dia)
  cli AS (
    SELECT DISTINCT ON (user_id) user_id, client_id
    FROM public.user_presence_heartbeats
    WHERE seen_at >= v_from AND seen_at < v_to
    GROUP BY user_id, client_id
    ORDER BY user_id, count(*) DESC
  )
  INSERT INTO public.user_presence_daily (user_id, client_id, day_brt, online_seconds, sessions_count, updated_at)
  SELECT a.user_id, c.client_id, p_day, a.online_seconds, a.sessions_count, now()
    FROM agg a JOIN cli c USING (user_id)
  ON CONFLICT (user_id, day_brt) DO UPDATE
    SET online_seconds = EXCLUDED.online_seconds,
        sessions_count = EXCLUDED.sessions_count,
        client_id      = EXCLUDED.client_id,
        updated_at     = now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$function$;