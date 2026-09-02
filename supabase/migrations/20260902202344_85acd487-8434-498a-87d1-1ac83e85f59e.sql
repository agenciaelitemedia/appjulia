DROP FUNCTION IF EXISTS public.chat_capacity_check(text, text);

CREATE OR REPLACE FUNCTION public.chat_capacity_check(
  p_client_id text,
  p_agent_identifier text
)
RETURNS TABLE (
  agent_identifier text,
  agent_name text,
  load integer,
  max_concurrent integer,
  blocked boolean,
  enforced boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH auto AS (
    SELECT coalesce(
             (SELECT (s.settings->>'auto_distribution_enabled')::boolean
              FROM public.chat_client_settings s
              WHERE s.client_id = p_client_id
              LIMIT 1),
             false
           ) AS enabled
  ), cap AS (
    SELECT c.agent_name,
           c.max_concurrent,
           coalesce(c.is_active, true) AS is_active
    FROM public.chat_agent_capacity c
    WHERE c.client_id = p_client_id
      AND c.agent_identifier = p_agent_identifier
    LIMIT 1
  ), lv AS (
    SELECT coalesce((SELECT l.load FROM public.chat_agent_live_load(p_client_id) l
                     WHERE l.agent_identifier = p_agent_identifier), 0) AS load
  ), calc AS (
    SELECT
      (SELECT agent_name FROM cap) AS agent_name,
      (SELECT load FROM lv) AS load,
      CASE
        WHEN (SELECT enabled FROM auto)
         AND (SELECT is_active FROM cap)
         AND coalesce((SELECT max_concurrent FROM cap), 0) > 0
        THEN (SELECT max_concurrent FROM cap)
        ELSE NULL
      END AS max_concurrent
  )
  SELECT
    p_agent_identifier,
    calc.agent_name,
    calc.load,
    calc.max_concurrent,
    calc.max_concurrent IS NOT NULL AND calc.load >= calc.max_concurrent,
    calc.max_concurrent IS NOT NULL
  FROM calc
$$;

GRANT EXECUTE ON FUNCTION public.chat_capacity_check(text, text) TO anon, authenticated, service_role;