
ALTER TABLE phone_extension_plans
  ADD COLUMN IF NOT EXISTS price_monthly numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_quarterly numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_semiannual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_annual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_extension_price numeric NOT NULL DEFAULT 0;

ALTER TABLE phone_user_plans
  ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS extra_extensions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS business_name text;
