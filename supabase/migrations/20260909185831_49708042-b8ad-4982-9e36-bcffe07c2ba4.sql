ALTER TABLE public.julia_plans
  ADD COLUMN IF NOT EXISTS setup_fee_monthly integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS setup_fee_semiannual integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS setup_fee_annual integer NOT NULL DEFAULT 0;

ALTER TABLE public.julia_orders
  ADD COLUMN IF NOT EXISTS setup_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount integer NOT NULL DEFAULT 0;