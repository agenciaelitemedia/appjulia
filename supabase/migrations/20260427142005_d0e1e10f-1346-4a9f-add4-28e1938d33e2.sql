CREATE TABLE public.module_embeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  url_template text NOT NULL DEFAULT '',
  auth_mode text NOT NULL DEFAULT 'simple' CHECK (auth_mode IN ('simple','signed')),
  hmac_secret text,
  hmac_ttl_seconds integer NOT NULL DEFAULT 300,
  iframe_sandbox text NOT NULL DEFAULT 'allow-scripts allow-forms allow-same-origin',
  iframe_referrer_policy text NOT NULL DEFAULT 'strict-origin',
  open_in_new_tab boolean NOT NULL DEFAULT false,
  allowed_origins text[],
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_module_embeds_code ON public.module_embeds(code);

ALTER TABLE public.module_embeds ENABLE ROW LEVEL SECURITY;

-- No policies: tabela só acessível via service role (edge function embed-config)
-- O secret HMAC nunca deve ser exposto ao client diretamente.

CREATE OR REPLACE FUNCTION public.update_module_embeds_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_module_embeds_updated_at
BEFORE UPDATE ON public.module_embeds
FOR EACH ROW
EXECUTE FUNCTION public.update_module_embeds_updated_at();