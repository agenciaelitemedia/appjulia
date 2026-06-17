
DROP MATERIALIZED VIEW IF EXISTS public.mv_user_sessions_daily CASCADE;

CREATE MATERIALIZED VIEW public.mv_user_sessions_daily AS
WITH ordered AS (
  SELECT 
    client_id, user_id, user_name, event_type, occurred_at,
    LEAD(event_type) OVER (PARTITION BY user_id ORDER BY occurred_at) AS next_event,
    LEAD(occurred_at) OVER (PARTITION BY user_id ORDER BY occurred_at) AS next_at
  FROM public.user_activity_log
  WHERE user_id IS NOT NULL AND client_id IS NOT NULL
),
sessions AS (
  SELECT 
    p.client_id, p.user_id, p.user_name,
    p.occurred_at AS login_at,
    LEAST(
      p.occurred_at + interval '12 hours',
      CASE 
        WHEN p.next_at IS NOT NULL THEN p.next_at
        ELSE LEAST(
          now(),
          COALESCE((SELECT up.last_seen_at + interval '5 minutes' 
                    FROM public.user_presence up WHERE up.user_id = p.user_id),
                   p.occurred_at + interval '12 hours')
        )
      END
    ) AS logout_at
  FROM ordered p
  WHERE p.event_type = 'login'
)
SELECT
  client_id,
  user_id,
  MAX(user_name) AS user_name,
  (login_at AT TIME ZONE 'America/Sao_Paulo')::date AS day_brt,
  COUNT(*)::int AS sessions_count,
  SUM(GREATEST(0, EXTRACT(EPOCH FROM (logout_at - login_at))))::bigint AS worked_seconds,
  MIN(login_at) AS first_login,
  MAX(logout_at) AS last_logout
FROM sessions
GROUP BY client_id, user_id, (login_at AT TIME ZONE 'America/Sao_Paulo')::date;

CREATE UNIQUE INDEX idx_mv_user_sessions_daily_uniq 
  ON public.mv_user_sessions_daily (client_id, user_id, day_brt);
CREATE INDEX idx_mv_user_sessions_daily_day 
  ON public.mv_user_sessions_daily (day_brt, client_id);
GRANT SELECT ON public.mv_user_sessions_daily TO authenticated;
GRANT ALL ON public.mv_user_sessions_daily TO service_role;
