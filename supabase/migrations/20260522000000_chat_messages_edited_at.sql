-- Edit message support: timestamp of the last edit (WhatsApp-style "editada" label).
-- Realtime UPDATE + REPLICA IDENTITY FULL are already enabled for chat_messages,
-- so setting this column propagates the edit to clients in real time.
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;
