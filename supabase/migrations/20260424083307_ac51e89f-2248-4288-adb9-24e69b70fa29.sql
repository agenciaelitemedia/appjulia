ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS phone_resolved_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_queues_client_phone_number ON public.queues (client_id, phone_number) WHERE phone_number IS NOT NULL;