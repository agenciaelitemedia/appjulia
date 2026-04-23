ALTER TABLE public.chat_contacts
  ADD COLUMN IF NOT EXISTS wa_name text,
  ADD COLUMN IF NOT EXISTS wa_verified_name text,
  ADD COLUMN IF NOT EXISTS wa_business boolean,
  ADD COLUMN IF NOT EXISTS wa_status text,
  ADD COLUMN IF NOT EXISTS lead_full_name text,
  ADD COLUMN IF NOT EXISTS lead_email text,
  ADD COLUMN IF NOT EXISTS lead_personalid text,
  ADD COLUMN IF NOT EXISTS profile_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_source text;

CREATE INDEX IF NOT EXISTS idx_chat_contacts_profile_fetched_at
  ON public.chat_contacts (client_id, profile_fetched_at NULLS FIRST);