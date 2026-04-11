-- Add unique index on message_id for deduplication (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_message_id_unique
ON public.chat_messages (message_id)
WHERE message_id IS NOT NULL;