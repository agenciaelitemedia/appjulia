
-- Wavoip: convert from per-user to per-client (escritório) ownership, matching telephony admin pattern.

ALTER TABLE public.wavoip_user_plans
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS client_id bigint,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS extra_devices integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_date date NOT NULL DEFAULT (now()::date),
  ADD COLUMN IF NOT EXISTS due_date date;

CREATE INDEX IF NOT EXISTS wavoip_user_plans_client_idx
  ON public.wavoip_user_plans(client_id, is_active);

ALTER TABLE public.wavoip_devices
  ADD COLUMN IF NOT EXISTS client_id bigint;
CREATE INDEX IF NOT EXISTS wavoip_devices_client_idx
  ON public.wavoip_devices(client_id);

ALTER TABLE public.wavoip_orders
  ADD COLUMN IF NOT EXISTS client_id bigint;
CREATE INDEX IF NOT EXISTS wavoip_orders_client_idx
  ON public.wavoip_orders(client_id);

ALTER TABLE public.wavoip_call_logs
  ADD COLUMN IF NOT EXISTS client_id bigint;
CREATE INDEX IF NOT EXISTS wavoip_call_logs_client_idx
  ON public.wavoip_call_logs(client_id, created_at DESC);
