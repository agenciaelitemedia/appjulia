
ALTER TABLE public.chat_contacts
  ADD COLUMN IF NOT EXISTS channel_type TEXT NOT NULL DEFAULT 'whatsapp_uazapi',
  ADD COLUMN IF NOT EXISTS channel_source TEXT,
  ADD COLUMN IF NOT EXISTS remote_jid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_contacts_channel
  ON public.chat_contacts (client_id, channel_source, phone)
  WHERE channel_source IS NOT NULL;
