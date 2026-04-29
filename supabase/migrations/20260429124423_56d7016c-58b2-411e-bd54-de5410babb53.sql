-- Tabela de provedores de telefonia
CREATE TABLE IF NOT EXISTS public.telephony_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('api4com', '3cplus')),
  api4com_domain TEXT,
  api4com_token TEXT,
  sip_domain TEXT,
  threecplus_token TEXT,
  threecplus_base_url TEXT,
  threecplus_ws_url TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telephony_providers_provider ON public.telephony_providers(provider);
CREATE INDEX IF NOT EXISTS idx_telephony_providers_is_default ON public.telephony_providers(is_default) WHERE is_default = true;

ALTER TABLE public.telephony_providers ENABLE ROW LEVEL SECURITY;

-- Apenas usuários autenticados (admin) gerenciam provedores
CREATE POLICY "Authenticated can view telephony_providers"
  ON public.telephony_providers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert telephony_providers"
  ON public.telephony_providers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update telephony_providers"
  ON public.telephony_providers FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can delete telephony_providers"
  ON public.telephony_providers FOR DELETE
  TO authenticated
  USING (true);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.update_telephony_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_telephony_providers_updated_at ON public.telephony_providers;
CREATE TRIGGER trg_telephony_providers_updated_at
  BEFORE UPDATE ON public.telephony_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_telephony_providers_updated_at();