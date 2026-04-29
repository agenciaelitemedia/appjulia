ALTER TABLE public.phone_extension_plans
  ADD COLUMN IF NOT EXISTS setup_fee_monthly numeric,
  ADD COLUMN IF NOT EXISTS setup_fee_quarterly numeric,
  ADD COLUMN IF NOT EXISTS setup_fee_semiannual numeric,
  ADD COLUMN IF NOT EXISTS setup_fee_annual numeric;