ALTER TABLE public.phone_config
  ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.telephony_providers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_phone_config_provider_id ON public.phone_config(provider_id);