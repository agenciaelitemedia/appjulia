ALTER TABLE public.queues
  ADD COLUMN IF NOT EXISTS waba_webhook_status text,
  ADD COLUMN IF NOT EXISTS waba_webhook_last_error text,
  ADD COLUMN IF NOT EXISTS waba_webhook_subscribed_at timestamptz;

-- Backfill: existing WABA queues without a status get 'pending' so the retry job can pick them up.
UPDATE public.queues
   SET waba_webhook_status = 'pending'
 WHERE channel_type = 'waba'
   AND waba_webhook_status IS NULL
   AND waba_id IS NOT NULL
   AND waba_token IS NOT NULL;