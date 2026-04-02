ALTER TABLE julia_plans 
  ADD COLUMN price_monthly integer NOT NULL DEFAULT 0,
  ADD COLUMN price_semiannual integer NOT NULL DEFAULT 0,
  ADD COLUMN price_annual integer NOT NULL DEFAULT 0;

UPDATE julia_plans SET price_monthly = price;