ALTER TABLE public.phone_extensions
  ADD COLUMN IF NOT EXISTS sip_manual_domain text,
  ADD COLUMN IF NOT EXISTS sip_manual_username text,
  ADD COLUMN IF NOT EXISTS sip_manual_password text;