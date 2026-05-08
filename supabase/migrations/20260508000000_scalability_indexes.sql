-- ============================================================
-- Scalability: composite indexes for high-volume queries
-- ============================================================

-- 1. chat_messages: used by get_return_chat_candidates() (runs every minute)
--    and by message history queries per conversation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_conv_from_ts
  ON chat_messages(conversation_id, from_me, timestamp DESC)
  WHERE conversation_id IS NOT NULL;

-- 2. chat_conversations: used by every contact-list and status-filter query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_conversations_client_status_upd
  ON chat_conversations(client_id, status, updated_at DESC);

-- 3. chat_contacts: used by loadContacts() order by last_message_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_contacts_client_lastmsg
  ON chat_contacts(client_id, last_message_at DESC NULLS LAST);

-- 4. chat_conversations: used by get_return_chat_candidates() WHERE clause
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_conversations_client_nrt
  ON chat_conversations(client_id, status, assigned_to, last_message_from_me)
  WHERE status IN ('open', 'pending')
    AND assigned_to IS NOT NULL
    AND last_message_from_me = false;
