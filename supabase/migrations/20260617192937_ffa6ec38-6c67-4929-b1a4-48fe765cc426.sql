
-- ============ MV 1: User sessions per day ============
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_user_sessions_daily AS
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
    CASE 
      WHEN p.next_at IS NOT NULL THEN p.next_at
      ELSE LEAST(
        now(),
        COALESCE((SELECT up.last_seen_at + interval '5 minutes' 
                  FROM public.user_presence up WHERE up.user_id = p.user_id),
                 p.occurred_at + interval '12 hours')
      )
    END AS logout_at
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_sessions_daily_uniq 
  ON public.mv_user_sessions_daily (client_id, user_id, day_brt);
CREATE INDEX IF NOT EXISTS idx_mv_user_sessions_daily_day 
  ON public.mv_user_sessions_daily (day_brt, client_id);
GRANT SELECT ON public.mv_user_sessions_daily TO authenticated;
GRANT ALL ON public.mv_user_sessions_daily TO service_role;

-- ============ MV 2: Chat events per user per day ============
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_user_chat_daily AS
WITH events AS (
  SELECT c.client_id, h.action, h.actor_name, h.from_value, h.to_value, h.created_at, h.conversation_id
  FROM public.chat_conversation_history h
  JOIN public.chat_conversations c ON c.id = h.conversation_id
),
received AS (
  SELECT client_id, TRIM(to_value) AS user_name, created_at AS at, conversation_id
  FROM events 
  WHERE action = 'assigned' 
    AND to_value IS NOT NULL 
    AND TRIM(to_value) NOT IN ('resolved','closed','pending','')
),
exits_raw AS (
  SELECT client_id, TRIM(actor_name) AS user_name, created_at AS at, 'resolved'::text AS kind, conversation_id
    FROM events WHERE action IN ('resolved','closed') AND actor_name IS NOT NULL AND TRIM(actor_name) <> 'Sistema'
  UNION ALL
  SELECT client_id, TRIM(COALESCE(from_value, actor_name)) AS user_name, created_at, 'returned'::text, conversation_id
    FROM events WHERE action IN ('returned_to_queue','auto_returned') AND COALESCE(from_value, actor_name) IS NOT NULL
  UNION ALL
  SELECT client_id, TRIM(from_value) AS user_name, created_at, 'transferred'::text, conversation_id
    FROM events 
    WHERE action = 'assigned' AND from_value IS NOT NULL 
      AND TRIM(from_value) <> '' AND TRIM(from_value) <> TRIM(to_value)
),
handle AS (
  SELECT 
    r.client_id, r.user_name, r.at AS received_at, r.conversation_id,
    (SELECT MIN(e.at) FROM exits_raw e 
      WHERE e.conversation_id = r.conversation_id AND e.user_name = r.user_name AND e.at > r.at) AS exit_at
  FROM received r
),
unified AS (
  SELECT client_id, user_name, 
    (received_at AT TIME ZONE 'America/Sao_Paulo')::date AS day_brt,
    1 AS received, 0 AS resolved, 0 AS returned, 0 AS transferred,
    CASE WHEN exit_at IS NOT NULL THEN GREATEST(0, EXTRACT(EPOCH FROM (exit_at - received_at))) END AS handle_seconds
  FROM handle
  UNION ALL
  SELECT client_id, user_name,
    (at AT TIME ZONE 'America/Sao_Paulo')::date,
    0, CASE WHEN kind='resolved' THEN 1 ELSE 0 END,
    CASE WHEN kind='returned' THEN 1 ELSE 0 END,
    CASE WHEN kind='transferred' THEN 1 ELSE 0 END,
    NULL
  FROM exits_raw
)
SELECT 
  client_id, user_name, day_brt,
  SUM(received)::int AS received,
  SUM(resolved)::int AS resolved,
  SUM(returned)::int AS returned,
  SUM(transferred)::int AS transferred,
  ROUND(AVG(handle_seconds) FILTER (WHERE handle_seconds IS NOT NULL)::numeric, 0)::int AS avg_handle_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY handle_seconds) FILTER (WHERE handle_seconds IS NOT NULL)::int AS p50_handle_seconds,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY handle_seconds) FILTER (WHERE handle_seconds IS NOT NULL)::int AS p95_handle_seconds
FROM unified
WHERE user_name IS NOT NULL AND user_name <> ''
GROUP BY client_id, user_name, day_brt;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_chat_daily_uniq 
  ON public.mv_user_chat_daily (client_id, user_name, day_brt);
CREATE INDEX IF NOT EXISTS idx_mv_user_chat_daily_day 
  ON public.mv_user_chat_daily (day_brt, client_id);
GRANT SELECT ON public.mv_user_chat_daily TO authenticated;
GRANT ALL ON public.mv_user_chat_daily TO service_role;

-- ============ MV 3: Phone calls per user per day ============
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_user_phone_daily AS
WITH calls AS (
  SELECT 
    p.client_id::text AS client_id_text,
    p.cod_agent,
    p.direction,
    p.duration_seconds,
    p.answered_at,
    p.called,
    p.started_at,
    -- Normalize Brazilian phone for lead matching
    regexp_replace(COALESCE(p.called, ''), '[^0-9]', '', 'g') AS called_norm
  FROM public.phone_call_logs p
  WHERE p.cod_agent IS NOT NULL AND p.client_id IS NOT NULL
),
matched AS (
  SELECT c.*, 
    EXISTS(
      SELECT 1 FROM public.chat_contacts cc 
      WHERE cc.client_id = c.client_id_text 
        AND regexp_replace(COALESCE(cc.phone, ''), '[^0-9]', '', 'g') = c.called_norm
        AND c.called_norm <> ''
      LIMIT 1
    ) AS is_known_lead
  FROM calls c
)
SELECT
  client_id_text AS client_id,
  cod_agent,
  (started_at AT TIME ZONE 'America/Sao_Paulo')::date AS day_brt,
  COUNT(*)::int AS calls_total,
  COUNT(*) FILTER (WHERE answered_at IS NOT NULL)::int AS calls_answered,
  COUNT(*) FILTER (WHERE direction = 'outbound')::int AS calls_outbound,
  COUNT(*) FILTER (WHERE direction = 'inbound')::int AS calls_inbound,
  COALESCE(SUM(duration_seconds), 0)::bigint AS talk_seconds,
  ROUND(AVG(duration_seconds) FILTER (WHERE duration_seconds > 0)::numeric, 0)::int AS avg_call_seconds,
  COUNT(DISTINCT called_norm) FILTER (WHERE called_norm <> '')::int AS unique_numbers,
  COUNT(*) FILTER (WHERE is_known_lead)::int AS calls_to_known_leads
FROM matched
GROUP BY client_id_text, cod_agent, (started_at AT TIME ZONE 'America/Sao_Paulo')::date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_phone_daily_uniq 
  ON public.mv_user_phone_daily (client_id, cod_agent, day_brt);
CREATE INDEX IF NOT EXISTS idx_mv_user_phone_daily_day 
  ON public.mv_user_phone_daily (day_brt, client_id);
GRANT SELECT ON public.mv_user_phone_daily TO authenticated;
GRANT ALL ON public.mv_user_phone_daily TO service_role;

-- ============ MV 4: Top numbers called per user per day ============
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_user_phone_top_numbers AS
WITH ranked AS (
  SELECT
    p.client_id::text AS client_id,
    p.cod_agent,
    (p.started_at AT TIME ZONE 'America/Sao_Paulo')::date AS day_brt,
    regexp_replace(COALESCE(p.called, ''), '[^0-9]', '', 'g') AS called_norm,
    p.called,
    COUNT(*) AS call_count,
    COALESCE(SUM(p.duration_seconds), 0) AS total_seconds,
    MAX(p.started_at) AS last_call_at
  FROM public.phone_call_logs p
  WHERE p.cod_agent IS NOT NULL AND p.client_id IS NOT NULL
    AND p.called IS NOT NULL
  GROUP BY p.client_id::text, p.cod_agent, 
           (p.started_at AT TIME ZONE 'America/Sao_Paulo')::date,
           regexp_replace(COALESCE(p.called, ''), '[^0-9]', '', 'g'),
           p.called
),
flagged AS (
  SELECT r.*,
    EXISTS(
      SELECT 1 FROM public.chat_contacts cc
      WHERE cc.client_id = r.client_id
        AND regexp_replace(COALESCE(cc.phone, ''), '[^0-9]', '', 'g') = r.called_norm
        AND r.called_norm <> ''
      LIMIT 1
    ) AS is_known_lead,
    ROW_NUMBER() OVER (PARTITION BY r.client_id, r.cod_agent, r.day_brt 
                       ORDER BY r.call_count DESC, r.total_seconds DESC) AS rn
  FROM ranked r
)
SELECT 
  client_id, cod_agent, day_brt, 
  called_norm AS phone_normalized,
  called AS phone_display,
  call_count::int,
  total_seconds::bigint,
  last_call_at,
  is_known_lead,
  rn::int AS rank
FROM flagged
WHERE rn <= 20;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_phone_top_numbers_uniq 
  ON public.mv_user_phone_top_numbers (client_id, cod_agent, day_brt, phone_normalized);
GRANT SELECT ON public.mv_user_phone_top_numbers TO authenticated;
GRANT ALL ON public.mv_user_phone_top_numbers TO service_role;

-- ============ Refresh function ============
CREATE OR REPLACE FUNCTION public.refresh_team_performance_mvs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_user_sessions_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_user_chat_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_user_phone_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_user_phone_top_numbers;
END;
$$;
GRANT EXECUTE ON FUNCTION public.refresh_team_performance_mvs() TO authenticated, service_role;
