-- =====================================================
-- Self-service de telefonia: providers pool + orders + addons
-- =====================================================

-- 1) Pool de provedores (templates copiados ao provisionar)
CREATE TABLE IF NOT EXISTS public.telephony_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('api4com', '3cplus')),

  -- Api4Com
  api4com_domain TEXT,
  api4com_token TEXT,
  sip_domain TEXT,

  -- 3C+
  threecplus_token TEXT,
  threecplus_base_url TEXT,
  threecplus_ws_url TEXT,

  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Apenas 1 default por tipo de provider
CREATE UNIQUE INDEX IF NOT EXISTS uq_default_provider_per_type
  ON public.telephony_providers (provider) WHERE is_default = TRUE;

ALTER TABLE public.telephony_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access" ON public.telephony_providers
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "authenticated read" ON public.telephony_providers
  FOR SELECT USING (auth.role() = 'authenticated');

-- 2) Orders de telefonia (separado de julia_orders pois tem auto-provisioning)
CREATE TABLE IF NOT EXISTS public.telephony_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cliente
  client_id BIGINT NOT NULL,
  cod_agent TEXT,
  customer_name TEXT NOT NULL,
  customer_document TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_whatsapp TEXT,

  -- Plano
  plan_id INT NOT NULL REFERENCES public.phone_extension_plans(id),
  plan_name TEXT NOT NULL,
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly','quarterly','semiannual','annual')),
  extra_extensions INT NOT NULL DEFAULT 0,
  recording_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  transcription_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- Valores (centavos)
  plan_price INT NOT NULL,
  setup_fee INT NOT NULL DEFAULT 0,
  recording_total INT NOT NULL DEFAULT 0,
  transcription_total INT NOT NULL DEFAULT 0,
  extra_extensions_total INT NOT NULL DEFAULT 0,
  total_amount INT NOT NULL,

  -- Pagamento
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending','paid','provisioned','failed','cancelled')),
  payment_gateway TEXT,
  order_nsu TEXT UNIQUE,
  checkout_url TEXT,
  paid_amount INT,
  net_amount INT,
  fee_amount INT,
  paid_at TIMESTAMPTZ,
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  webhook_payload JSONB,

  -- Provisioning
  provider_id UUID REFERENCES public.telephony_providers(id),
  provisioned_at TIMESTAMPTZ,
  provisioning_error TEXT,
  user_plan_id INT,
  config_id INT,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telephony_orders_status ON public.telephony_orders(status);
CREATE INDEX IF NOT EXISTS idx_telephony_orders_client ON public.telephony_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_telephony_orders_created ON public.telephony_orders(created_at DESC);

ALTER TABLE public.telephony_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access" ON public.telephony_orders
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "authenticated read own" ON public.telephony_orders
  FOR SELECT USING (auth.role() = 'authenticated');

-- 3) Addons no phone_user_plans
ALTER TABLE public.phone_user_plans
  ADD COLUMN IF NOT EXISTS recording_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS transcription_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_order_id UUID REFERENCES public.telephony_orders(id);

-- Trigger updated_at automático
CREATE OR REPLACE FUNCTION public.touch_telephony_orders_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_telephony_orders_touch ON public.telephony_orders;
CREATE TRIGGER trg_telephony_orders_touch
  BEFORE UPDATE ON public.telephony_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_telephony_orders_updated_at();

DROP TRIGGER IF EXISTS trg_telephony_providers_touch ON public.telephony_providers;
CREATE TRIGGER trg_telephony_providers_touch
  BEFORE UPDATE ON public.telephony_providers
  FOR EACH ROW EXECUTE FUNCTION public.touch_telephony_orders_updated_at();
