ALTER TABLE public.telephony_orders
  ADD COLUMN IF NOT EXISTS paid_amount integer,
  ADD COLUMN IF NOT EXISTS net_amount integer,
  ADD COLUMN IF NOT EXISTS fee_amount integer,
  ADD COLUMN IF NOT EXISTS webhook_payload jsonb,
  ADD COLUMN IF NOT EXISTS mp_payment_id text,
  ADD COLUMN IF NOT EXISTS provisioning_error text;