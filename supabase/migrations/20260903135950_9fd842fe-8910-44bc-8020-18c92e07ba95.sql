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
      AND (conv.assigned_user_id IS NOT NULL OR btrim(coalesce(conv.assigned_to, '')) <> '')
  ) s
  WHERE ident IS NOT NULL
  GROUP BY ident
$function$;

UPDATE public.chat_agent_capacity c
   SET current_load = coalesce((
         SELECT l.load FROM public.chat_agent_live_load(c.client_id) l
         WHERE l.agent_identifier = c.agent_identifier
       ), 0),
       updated_at = now();