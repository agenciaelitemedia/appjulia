-- Fase 1: Adicionar campo NRT em chat_sla_configs
ALTER TABLE chat_sla_configs
  ADD COLUMN IF NOT EXISTS nrt_response_minutes INTEGER NOT NULL DEFAULT 60;

-- Fase 2: Adicionar campos de rastreamento em chat_conversations
ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS last_customer_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_message_from_me BOOLEAN DEFAULT NULL;

-- Fase 3: Trigger para atualizar os campos a cada INSERT em chat_messages
CREATE OR REPLACE FUNCTION update_conversation_message_tracking()
RETURNS trigger LANGUAGE plpgsql AS $$
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
FOR EACH ROW EXECUTE FUNCTION update_conversation_message_tracking();

-- Fase 4: Backfill para conversas existentes
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
