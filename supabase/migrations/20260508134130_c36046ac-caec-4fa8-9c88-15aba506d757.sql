-- =============================
-- Parte 1: NRT columns + trigger + backfill
-- =============================
ALTER TABLE chat_sla_configs
  ADD COLUMN IF NOT EXISTS nrt_response_minutes INTEGER NOT NULL DEFAULT 60;

ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS last_customer_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_message_from_me BOOLEAN DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.update_conversation_message_tracking()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.conversation_id IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE chat_conversations
  SET
    last_customer_message_at = CASE
      WHEN NEW.from_me = false THEN NEW.created_at
      ELSE last_customer_message_at
    END,
    last_message_from_me = NEW.from_me
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conversation_message_tracking ON chat_messages;
CREATE TRIGGER trg_update_conversation_message_tracking
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION public.update_conversation_message_tracking();

UPDATE chat_conversations c
SET
  last_message_from_me = last_msg.from_me,
  last_customer_message_at = (
    SELECT MAX(created_at) FROM chat_messages
    WHERE conversation_id = c.id AND from_me = false
  )
FROM (
  SELECT DISTINCT ON (conversation_id)
    conversation_id, from_me, created_at
  FROM chat_messages
  ORDER BY conversation_id, created_at DESC
) last_msg
WHERE last_msg.conversation_id = c.id;

-- =============================
-- Parte 2: Índice composto para a RPC otimizada
-- =============================
CREATE INDEX IF NOT EXISTS idx_chat_conversations_client_nrt
  ON chat_conversations(client_id, status, assigned_to, last_message_from_me)
  WHERE status IN ('open', 'pending')
    AND assigned_to IS NOT NULL
    AND last_message_from_me = false;

-- =============================
-- Parte 3: RPC otimizada
-- =============================
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
  SELECT
    c.id,
    c.client_id,
    c.contact_id,
    c.assigned_to,
    c.priority::text,
    c.channel,
    c.queue_id,
    c.last_customer_message_at,
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
    AND now() >= c.last_customer_message_at
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
        AND h.created_at >= c.last_customer_message_at
    )
  ORDER BY c.last_customer_message_at ASC
  LIMIT GREATEST(batch_limit, 1);
$$;