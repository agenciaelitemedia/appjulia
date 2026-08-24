ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_conversation_assigned_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL AND TRIM(NEW.assigned_to) <> '' AND NEW.assigned_at IS NULL THEN
      NEW.assigned_at := now();
    END IF;
  ELSE
    IF COALESCE(TRIM(NEW.assigned_to), '') <> COALESCE(TRIM(OLD.assigned_to), '')
       AND NEW.assigned_to IS NOT NULL
       AND TRIM(NEW.assigned_to) <> '' THEN
      NEW.assigned_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_conversation_assigned_at ON public.chat_conversations;
CREATE TRIGGER trg_set_conversation_assigned_at
BEFORE INSERT OR UPDATE OF assigned_to ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.set_conversation_assigned_at();

CREATE OR REPLACE FUNCTION public.get_return_chat_candidates(batch_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, client_id text, contact_id uuid, assigned_to text, priority text, channel text, queue_id uuid, last_customer_message_at timestamp with time zone, nrt_minutes integer, tolerance_minutes integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.id,
    c.client_id,
    c.contact_id,
    c.assigned_to,
    c.priority::text,
    c.channel,
    c.queue_id,
    GREATEST(c.last_customer_message_at, COALESCE(c.assigned_at, c.last_customer_message_at)) AS last_customer_message_at,
    COALESCE(s.nrt_response_minutes,
             CASE c.priority::text
               WHEN 'urgent' THEN 30
               WHEN 'high'   THEN 120
               WHEN 'low'    THEN 480
               ELSE 240
             END)::int AS nrt_minutes,
    COALESCE((cs.settings->>'return_chat_tolerance_minutes')::int, 0) AS tolerance_minutes
  FROM public.chat_conversations c
  JOIN public.chat_client_settings cs
    ON cs.client_id = c.client_id
   AND COALESCE((cs.settings->>'return_chat_enabled')::boolean, false) = true
  LEFT JOIN public.chat_sla_configs s
    ON s.client_id = c.client_id
   AND s.priority::text = c.priority::text
   AND s.is_active = true
  WHERE c.status IN ('open', 'pending')
    AND c.assigned_to IS NOT NULL
    AND TRIM(c.assigned_to) <> ''
    AND c.last_message_from_me = false
    AND c.last_customer_message_at IS NOT NULL
    AND now() >= GREATEST(c.last_customer_message_at, COALESCE(c.assigned_at, c.last_customer_message_at))
        + ((COALESCE(s.nrt_response_minutes,
            CASE c.priority::text
              WHEN 'urgent' THEN 30
              WHEN 'high'   THEN 120
              WHEN 'low'    THEN 480
              ELSE 240
            END)
          + COALESCE((cs.settings->>'return_chat_tolerance_minutes')::int, 0)) * interval '1 minute')
    AND NOT EXISTS (
      SELECT 1
      FROM public.chat_conversation_history h
      WHERE h.conversation_id = c.id
        AND h.action = 'auto_returned'
        AND h.created_at >= GREATEST(c.last_customer_message_at, COALESCE(c.assigned_at, c.last_customer_message_at))
    )
  ORDER BY GREATEST(c.last_customer_message_at, COALESCE(c.assigned_at, c.last_customer_message_at)) ASC
  LIMIT GREATEST(batch_limit, 1);
$function$;