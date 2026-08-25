ALTER TABLE public.phone_call_logs
  ADD COLUMN IF NOT EXISTS contact_phone_e164 text,
  ADD COLUMN IF NOT EXISTS contact_id uuid;

ALTER TABLE public.wavoip_call_logs
  ADD COLUMN IF NOT EXISTS contact_phone_e164 text;

CREATE INDEX IF NOT EXISTS idx_phone_call_logs_client_contact
  ON public.phone_call_logs (client_id, contact_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_call_logs_client_phone
  ON public.phone_call_logs (client_id, contact_phone_e164);
CREATE INDEX IF NOT EXISTS idx_wavoip_call_logs_client_contact
  ON public.wavoip_call_logs (client_id, contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wavoip_call_logs_client_phone
  ON public.wavoip_call_logs (client_id, contact_phone_e164);