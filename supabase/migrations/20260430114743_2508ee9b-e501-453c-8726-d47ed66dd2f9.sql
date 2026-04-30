ALTER TABLE public.phone_config
ALTER COLUMN cod_agent DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_phone_config_client_provider_active
  ON public.phone_config (client_id, provider)
  WHERE client_id IS NOT NULL AND is_active = true;