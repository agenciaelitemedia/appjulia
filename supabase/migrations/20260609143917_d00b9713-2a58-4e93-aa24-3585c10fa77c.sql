
ALTER TABLE public.chat_contacts
  ADD COLUMN IF NOT EXISTS avatar_storage_path text,
  ADD COLUMN IF NOT EXISTS avatar_source_url text,
  ADD COLUMN IF NOT EXISTS avatar_source_hash text,
  ADD COLUMN IF NOT EXISTS avatar_refreshed_at timestamptz,
  ADD COLUMN IF NOT EXISTS avatar_refresh_requested_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_chat_contacts_avatar_refreshed_at
  ON public.chat_contacts (avatar_refreshed_at NULLS FIRST);
