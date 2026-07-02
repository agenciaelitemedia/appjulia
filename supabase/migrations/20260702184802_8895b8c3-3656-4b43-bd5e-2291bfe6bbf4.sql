CREATE INDEX IF NOT EXISTS idx_chat_conversations_client_queue_status_upd
  ON public.chat_conversations (client_id, queue_id, status, updated_at DESC);