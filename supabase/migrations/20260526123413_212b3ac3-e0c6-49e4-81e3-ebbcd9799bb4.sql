CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_chat_contacts_name_trgm
  ON public.chat_contacts USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_chat_contacts_phone_trgm
  ON public.chat_contacts USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_chat_contacts_client_isgroup_lastmsg
  ON public.chat_contacts (client_id, is_group, last_message_at DESC NULLS LAST);