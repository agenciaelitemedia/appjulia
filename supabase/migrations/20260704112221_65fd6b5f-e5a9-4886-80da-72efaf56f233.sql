
-- Cleanup client data
TRUNCATE public.wavoip_orders, public.wavoip_devices, public.wavoip_user_plans RESTART IDENTITY CASCADE;

-- Plans: link provider
ALTER TABLE public.wavoip_plans
  ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.wavoip_providers(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS wavoip_plans_provider_idx ON public.wavoip_plans(provider_id);

-- Devices: link provider + store Wavoip identity
ALTER TABLE public.wavoip_devices
  ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.wavoip_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wavoip_device_id bigint,
  ADD COLUMN IF NOT EXISTS wavoip_raw jsonb;

CREATE INDEX IF NOT EXISTS wavoip_devices_provider_idx ON public.wavoip_devices(provider_id);
CREATE UNIQUE INDEX IF NOT EXISTS wavoip_devices_wavoip_id_uidx
  ON public.wavoip_devices(wavoip_device_id) WHERE wavoip_device_id IS NOT NULL;

-- device_token was NOT NULL. New paid-flow inserts happen in two steps sometimes;
-- keep NOT NULL because the /devices/:id call always returns a token before insert.
