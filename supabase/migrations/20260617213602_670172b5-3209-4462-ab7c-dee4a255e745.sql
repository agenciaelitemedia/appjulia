CREATE OR REPLACE FUNCTION public.get_user_presence_sessions(
  p_user_id bigint,
  p_from timestamp with time zone,
  p_to timestamp with time zone
)
RETURNS TABLE(
  login_at timestamp with time zone,
  logout_at timestamp with time zone,
  logout_type text,
  duration_seconds bigint,
  open boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH slots AS (
    SELECT DISTINCT
      to_timestamp(floor(extract(epoch FROM h.seen_at) / 30) * 30)::timestamptz AS slot_at
    FROM public.user_presence_heartbeats h
    WHERE h.user_id = p_user_id
      AND h.seen_at >= p_from
      AND h.seen_at < p_to
  ),
  marked AS (
    SELECT
      slot_at,
      CASE
        WHEN lag(slot_at) OVER (ORDER BY slot_at) IS NULL THEN 1
        WHEN slot_at - lag(slot_at) OVER (ORDER BY slot_at) > interval '2 minutes' THEN 1
        ELSE 0
      END AS new_group
    FROM slots
  ),
  grouped AS (
    SELECT
      slot_at,
      sum(new_group) OVER (ORDER BY slot_at ROWS UNBOUNDED PRECEDING) AS session_group
    FROM marked
  ),
  sessions AS (
    SELECT
      min(slot_at) AS start_at,
      max(slot_at) AS last_slot_at,
      count(*)::bigint AS slot_count
    FROM grouped
    GROUP BY session_group
  )
  SELECT
    start_at AS login_at,
    CASE WHEN now() - last_slot_at <= interval '2 minutes' THEN NULL ELSE last_slot_at + interval '30 seconds' END AS logout_at,
    CASE WHEN now() - last_slot_at <= interval '2 minutes' THEN NULL ELSE 'logout_inactivity'::text END AS logout_type,
    (slot_count * 30)::bigint AS duration_seconds,
    (now() - last_slot_at <= interval '2 minutes') AS open
  FROM sessions
  ORDER BY start_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_presence_sessions(bigint, timestamp with time zone, timestamp with time zone) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_presence_sessions(bigint, timestamp with time zone, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_presence_sessions(bigint, timestamp with time zone, timestamp with time zone) TO service_role;