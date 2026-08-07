CREATE TABLE IF NOT EXISTS public.xj_provider_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('llm','voice')),
  is_enabled boolean NOT NULL DEFAULT false,
  enabled_models jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, kind)
);

GRANT ALL ON public.xj_provider_settings TO service_role;
ALTER TABLE public.xj_provider_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.xj_client_provider_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  provider text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('llm','voice')),
  api_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, provider, kind)
);

GRANT ALL ON public.xj_client_provider_keys TO service_role;
ALTER TABLE public.xj_client_provider_keys ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.xj_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_xj_provider_settings_updated ON public.xj_provider_settings;
CREATE TRIGGER trg_xj_provider_settings_updated
BEFORE UPDATE ON public.xj_provider_settings
FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();

DROP TRIGGER IF EXISTS trg_xj_client_provider_keys_updated ON public.xj_client_provider_keys;
CREATE TRIGGER trg_xj_client_provider_keys_updated
BEFORE UPDATE ON public.xj_client_provider_keys
FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();

ALTER TABLE public.xj_agents
  ADD COLUMN IF NOT EXISTS llm_key_mode text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS voice_key_mode text NOT NULL DEFAULT 'default';