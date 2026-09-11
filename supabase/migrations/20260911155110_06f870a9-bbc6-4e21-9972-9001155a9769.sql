ALTER TABLE public.quick_messages
  ADD COLUMN IF NOT EXISTS client_id text,
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_quick_messages_client_shared
  ON public.quick_messages (client_id, is_shared);