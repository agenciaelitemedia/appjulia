ALTER TABLE public.phone_user_plans
  ADD COLUMN IF NOT EXISTS source_order_id uuid;
CREATE INDEX IF NOT EXISTS idx_phone_user_plans_source_order_id
  ON public.phone_user_plans(source_order_id);