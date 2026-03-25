
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS channel_type TEXT NOT NULL DEFAULT 'whatsapp_uazapi',
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS forwarded_score SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_external
  ON public.chat_messages (contact_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_ext_lookup
  ON public.chat_messages (external_id)
  WHERE external_id IS NOT NULL;
