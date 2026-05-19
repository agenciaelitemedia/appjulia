CREATE UNIQUE INDEX IF NOT EXISTS chat_contacts_unique_jid_idx
  ON public.chat_contacts (client_id, channel_source, remote_jid)
  WHERE remote_jid IS NOT NULL AND is_group = false;