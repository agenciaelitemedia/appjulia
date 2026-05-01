-- Composite index to speed up the chat list query:
-- SELECT ... FROM chat_contacts
-- WHERE client_id = ? AND channel_source IN (...)
-- AND last_message_at >= ?  ORDER BY last_message_at DESC LIMIT 50
CREATE INDEX IF NOT EXISTS idx_chat_contacts_client_queue_lastmsg
  ON public.chat_contacts (client_id, channel_source, last_message_at DESC NULLS LAST);
