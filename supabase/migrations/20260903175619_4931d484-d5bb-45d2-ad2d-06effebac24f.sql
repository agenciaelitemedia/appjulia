CREATE OR REPLACE FUNCTION public.chat_agent_live_load(p_client_id text)
 RETURNS TABLE(agent_identifier text, load integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT ident AS agent_identifier, count(*)::int AS load
  FROM (
    SELECT public.chat_resolve_assignee_identifier(
             conv.client_id, conv.assigned_user_id, conv.assigned_to
           ) AS ident
    FROM public.chat_conversations conv
    WHERE conv.client_id = p_client_id
      AND conv.status = 'open'
      AND (conv.snoozed_until IS NULL OR conv.snoozed_until <= now())
      AND (conv.assigned_user_id IS NOT NULL OR btrim(coalesce(conv.assigned_to, '')) <> '')
  ) s
  WHERE ident IS NOT NULL
  GROUP BY ident
$function$;

CREATE OR REPLACE FUNCTION public.chat_agent_load_by_queue(p_client_id text)
 RETURNS TABLE(agent_identifier text, queue_id uuid, load integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT ident AS agent_identifier, q_id AS queue_id, count(*)::int AS load
  FROM (
    SELECT public.chat_resolve_assignee_identifier(
             conv.client_id, conv.assigned_user_id, conv.assigned_to
           ) AS ident,
           conv.queue_id AS q_id
    FROM public.chat_conversations conv
    WHERE conv.client_id = p_client_id
      AND conv.status = 'open'
      AND (conv.snoozed_until IS NULL OR conv.snoozed_until <= now())
      AND (conv.assigned_user_id IS NOT NULL OR btrim(coalesce(conv.assigned_to, '')) <> '')
  ) s
  WHERE ident IS NOT NULL
  GROUP BY ident, q_id
$function$;

CREATE OR REPLACE FUNCTION public.chat_capacity_check(
  p_client_id text,
  p_agent_identifier text,
  p_allowed_queues uuid[]
)
 RETURNS TABLE(agent_identifier text, agent_name text, load integer, max_concurrent integer, blocked boolean, enforced boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
    SELECT coalesce(sum(l.load), 0)::int AS load
    FROM public.chat_agent_load_by_queue(p_client_id) l
    WHERE l.agent_identifier = p_agent_identifier
      AND (
        p_allowed_queues IS NULL
        OR l.queue_id IS NULL
        OR l.queue_id = ANY(p_allowed_queues)
      )
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
$function$;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_capacity_load
  ON public.chat_conversations (client_id, status, queue_id, assigned_user_id);
