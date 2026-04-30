ALTER TABLE public.telephony_orders
  ADD COLUMN IF NOT EXISTS provider_id bigint,
  ADD COLUMN IF NOT EXISTS config_id bigint,
  ADD COLUMN IF NOT EXISTS user_plan_id bigint;