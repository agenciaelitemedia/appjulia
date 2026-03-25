
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS contact_id UUID;
