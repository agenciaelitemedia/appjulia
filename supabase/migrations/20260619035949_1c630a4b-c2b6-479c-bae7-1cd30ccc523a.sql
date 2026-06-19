
CREATE OR REPLACE FUNCTION public.get_team_work_window_by_day(
  p_user_ids bigint[],
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE(
  user_id bigint,
  day_brt date,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  span_seconds bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    h.user_id::bigint,
    (h.seen_at AT TIME ZONE 'America/Sao_Paulo')::date AS day_brt,
    min(h.seen_at) AS first_seen_at,
    max(h.seen_at) AS last_seen_at,
    GREATEST(EXTRACT(EPOCH FROM (max(h.seen_at) - min(h.seen_at)))::bigint + 30, 30) AS span_seconds
  FROM public.user_presence_heartbeats h
  WHERE h.user_id = ANY (COALESCE(p_user_ids, ARRAY[]::bigint[]))
    AND h.seen_at >= p_from
    AND h.seen_at <  p_to
  GROUP BY h.user_id, (h.seen_at AT TIME ZONE 'America/Sao_Paulo')::date
  ORDER BY day_brt, user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_work_window_by_day(bigint[], timestamptz, timestamptz) TO authenticated, service_role;
