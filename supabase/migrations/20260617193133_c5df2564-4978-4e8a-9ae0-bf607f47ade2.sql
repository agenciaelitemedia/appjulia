
DROP MATERIALIZED VIEW IF EXISTS public.mv_user_phone_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_user_phone_top_numbers CASCADE;

CREATE MATERIALIZED VIEW public.mv_user_phone_daily AS
WITH calls AS (
  SELECT 
    p.client_id::text AS client_id_text,
    e.assigned_member_id AS user_id,
    p.cod_agent,
    p.direction,
    p.duration_seconds,
    p.answered_at,
    p.called,
    p.started_at,
    regexp_replace(COALESCE(p.called, ''), '[^0-9]', '', 'g') AS called_norm
  FROM public.phone_call_logs p
  LEFT JOIN public.phone_extensions e 
    ON e.extension_number = p.extension_number 
   AND e.client_id::text = p.client_id::text
  WHERE p.client_id IS NOT NULL AND e.assigned_member_id IS NOT NULL
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
  user_id,
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
GROUP BY client_id_text, user_id, (started_at AT TIME ZONE 'America/Sao_Paulo')::date;

CREATE UNIQUE INDEX idx_mv_user_phone_daily_uniq 
  ON public.mv_user_phone_daily (client_id, user_id, day_brt);
CREATE INDEX idx_mv_user_phone_daily_day ON public.mv_user_phone_daily (day_brt, client_id);
GRANT SELECT ON public.mv_user_phone_daily TO authenticated;
GRANT ALL ON public.mv_user_phone_daily TO service_role;

CREATE MATERIALIZED VIEW public.mv_user_phone_top_numbers AS
WITH ranked AS (
  SELECT
    p.client_id::text AS client_id,
    e.assigned_member_id AS user_id,
    (p.started_at AT TIME ZONE 'America/Sao_Paulo')::date AS day_brt,
    regexp_replace(COALESCE(p.called, ''), '[^0-9]', '', 'g') AS called_norm,
    MAX(p.called) AS called_display,
    COUNT(*) AS call_count,
    COALESCE(SUM(p.duration_seconds), 0) AS total_seconds,
    MAX(p.started_at) AS last_call_at
  FROM public.phone_call_logs p
  JOIN public.phone_extensions e 
    ON e.extension_number = p.extension_number 
   AND e.client_id::text = p.client_id::text
  WHERE p.client_id IS NOT NULL 
    AND p.called IS NOT NULL
    AND e.assigned_member_id IS NOT NULL
  GROUP BY p.client_id::text, e.assigned_member_id,
           (p.started_at AT TIME ZONE 'America/Sao_Paulo')::date,
           regexp_replace(COALESCE(p.called, ''), '[^0-9]', '', 'g')
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
    ROW_NUMBER() OVER (PARTITION BY r.client_id, r.user_id, r.day_brt 
                       ORDER BY r.call_count DESC, r.total_seconds DESC) AS rn
  FROM ranked r
)
SELECT 
  client_id, user_id, day_brt, 
  called_norm AS phone_normalized,
  called_display AS phone_display,
  call_count::int,
  total_seconds::bigint,
  last_call_at,
  is_known_lead,
  rn::int AS rank
FROM flagged
WHERE rn <= 20;

CREATE UNIQUE INDEX idx_mv_user_phone_top_numbers_uniq 
  ON public.mv_user_phone_top_numbers (client_id, user_id, day_brt, phone_normalized);
GRANT SELECT ON public.mv_user_phone_top_numbers TO authenticated;
GRANT ALL ON public.mv_user_phone_top_numbers TO service_role;
