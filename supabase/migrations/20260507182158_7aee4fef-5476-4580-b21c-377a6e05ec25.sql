
CREATE OR REPLACE FUNCTION public.get_return_chat_candidates(batch_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  client_id text,
  contact_id uuid,
  assigned_to text,
  priority text,
  channel text,
  queue_id uuid,
  last_customer_message_at timestamptz,
  nrt_minutes integer,
  tolerance_minutes integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH last_msg AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.timestamp AS ts,
      m.from_me
    FROM public.chat_messages m
    WHERE m.conversation_id IS NOT NULL
      AND COALESCE(m.internal_note, false) = false
    ORDER BY m.conversation_id, m.timestamp DESC
  )
  SELECT
    c.id,
    c.client_id,
    c.contact_id,
    c.assigned_to,
    c.priority::text,
    c.channel,
    c.queue_id,
    lm.ts AS last_customer_message_at,
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
  JOIN last_msg lm
    ON lm.conversation_id = c.id
   AND lm.from_me = false
  LEFT JOIN public.chat_sla_configs s
    ON s.client_id = c.client_id
   AND s.priority::text = c.priority::text
   AND s.is_active = true
  WHERE c.status IN ('open', 'pending')
    AND c.assigned_to IS NOT NULL
    AND TRIM(c.assigned_to) <> ''
    AND now() >= lm.ts
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
        AND h.created_at >= lm.ts
    )
  ORDER BY lm.ts ASC
  LIMIT GREATEST(batch_limit, 1);
$$;
