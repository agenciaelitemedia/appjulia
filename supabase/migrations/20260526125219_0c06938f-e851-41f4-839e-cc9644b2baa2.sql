DROP INDEX IF EXISTS public.idx_chat_messages_external;
DROP INDEX IF EXISTS public.idx_chat_messages_contact;

CREATE INDEX IF NOT EXISTS idx_chat_messages_contact_inbound_ts
  ON public.chat_messages (contact_id, "timestamp" DESC)
  WHERE from_me = false AND message_id IS NOT NULL;

ANALYZE public.chat_messages;