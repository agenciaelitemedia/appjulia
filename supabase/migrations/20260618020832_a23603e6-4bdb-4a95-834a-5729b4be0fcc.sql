
-- 1) Campos de id no histórico de conversas
ALTER TABLE public.chat_conversation_history
  ADD COLUMN IF NOT EXISTS user_id      bigint,
  ADD COLUMN IF NOT EXISTS to_user_id   bigint,
  ADD COLUMN IF NOT EXISTS from_user_id bigint;

-- 2) Recriar a materialized view de chat por usuário/dia incluindo user_id
DROP MATERIALIZED VIEW IF EXISTS public.mv_user_chat_daily;

CREATE MATERIALIZED VIEW public.mv_user_chat_daily AS
WITH events AS (
  SELECT c.client_id,
         h.action,
         h.actor_name,
         h.from_value,
         h.to_value,
         h.user_id      AS h_user_id,
         h.to_user_id,
         h.from_user_id,
         h.created_at,
         h.conversation_id
    FROM chat_conversation_history h
    JOIN chat_conversations c ON c.id = h.conversation_id
),
received AS (
  SELECT events.client_id,
         TRIM(BOTH FROM events.to_value)     AS user_name,
         events.to_user_id                    AS user_id,
         events.created_at                    AS at,
         events.conversation_id
    FROM events
   WHERE events.action = 'assigned'
     AND events.to_value IS NOT NULL
     AND TRIM(BOTH FROM events.to_value) <> ALL (ARRAY['resolved','closed','pending',''])
),
exits_raw AS (
  SELECT events.client_id,
         TRIM(BOTH FROM events.actor_name)    AS user_name,
         COALESCE(events.h_user_id)           AS user_id,
         events.created_at                    AS at,
         'resolved'::text                     AS kind,
         events.conversation_id
    FROM events
   WHERE events.action = ANY (ARRAY['resolved','closed'])
     AND events.actor_name IS NOT NULL
     AND TRIM(BOTH FROM events.actor_name) <> 'Sistema'
  UNION ALL
  SELECT events.client_id,
         TRIM(BOTH FROM COALESCE(events.from_value, events.actor_name)) AS user_name,
         COALESCE(events.from_user_id, events.h_user_id)                AS user_id,
         events.created_at,
         'returned'::text,
         events.conversation_id
    FROM events
   WHERE events.action = ANY (ARRAY['returned_to_queue','auto_returned'])
     AND COALESCE(events.from_value, events.actor_name) IS NOT NULL
  UNION ALL
  SELECT events.client_id,
         TRIM(BOTH FROM events.from_value)    AS user_name,
         events.from_user_id                   AS user_id,
         events.created_at,
         'transferred'::text,
         events.conversation_id
    FROM events
   WHERE events.action = 'assigned'
     AND events.from_value IS NOT NULL
     AND TRIM(BOTH FROM events.from_value) <> ''
     AND TRIM(BOTH FROM events.from_value) <> TRIM(BOTH FROM events.to_value)
),
handle AS (
  SELECT r.client_id,
         r.user_name,
         r.user_id,
         r.at AS received_at,
         r.conversation_id,
         (SELECT MIN(e.at)
            FROM exits_raw e
           WHERE e.conversation_id = r.conversation_id
             AND e.user_name = r.user_name
             AND e.at > r.at) AS exit_at
    FROM received r
),
unified AS (
  SELECT handle.client_id,
         handle.user_name,
         handle.user_id,
         ((handle.received_at AT TIME ZONE 'America/Sao_Paulo'))::date AS day_brt,
         1 AS received, 0 AS resolved, 0 AS returned, 0 AS transferred,
         CASE WHEN handle.exit_at IS NOT NULL
              THEN GREATEST(0::numeric, EXTRACT(epoch FROM (handle.exit_at - handle.received_at)))
              ELSE NULL::numeric END AS handle_seconds
    FROM handle
  UNION ALL
  SELECT exits_raw.client_id,
         exits_raw.user_name,
         exits_raw.user_id,
         ((exits_raw.at AT TIME ZONE 'America/Sao_Paulo'))::date AS day_brt,
         0,
         CASE WHEN exits_raw.kind = 'resolved'    THEN 1 ELSE 0 END,
         CASE WHEN exits_raw.kind = 'returned'    THEN 1 ELSE 0 END,
         CASE WHEN exits_raw.kind = 'transferred' THEN 1 ELSE 0 END,
         NULL::numeric
    FROM exits_raw
)
SELECT client_id,
       user_name,
       MAX(user_id)                                              AS user_id,
       day_brt,
       SUM(received)::int                                        AS received,
       SUM(resolved)::int                                        AS resolved,
       SUM(returned)::int                                        AS returned,
       SUM(transferred)::int                                     AS transferred,
       ROUND(AVG(handle_seconds) FILTER (WHERE handle_seconds IS NOT NULL), 0)::int                                  AS avg_handle_seconds,
       PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY handle_seconds::double precision) FILTER (WHERE handle_seconds IS NOT NULL)::int AS p50_handle_seconds,
       PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY handle_seconds::double precision) FILTER (WHERE handle_seconds IS NOT NULL)::int AS p95_handle_seconds
  FROM unified
 WHERE user_name IS NOT NULL AND user_name <> ''
 GROUP BY client_id, user_name, day_brt;

CREATE UNIQUE INDEX idx_mv_user_chat_daily_uniq
  ON public.mv_user_chat_daily (client_id, user_name, day_brt);
CREATE INDEX idx_mv_user_chat_daily_day
  ON public.mv_user_chat_daily (day_brt, client_id);
CREATE INDEX idx_mv_user_chat_daily_user_id
  ON public.mv_user_chat_daily (client_id, user_id, day_brt);
