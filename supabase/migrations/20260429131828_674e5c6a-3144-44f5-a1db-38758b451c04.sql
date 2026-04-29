
CREATE TABLE IF NOT EXISTS public.telephony_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_document TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_whatsapp TEXT,
  plan_id INTEGER NOT NULL,
  plan_name TEXT NOT NULL,
  billing_period TEXT NOT NULL,
  extra_extensions INTEGER NOT NULL DEFAULT 0,
  recording_enabled BOOLEAN NOT NULL DEFAULT false,
  transcription_enabled BOOLEAN NOT NULL DEFAULT false,
  plan_price INTEGER NOT NULL DEFAULT 0,
  setup_fee INTEGER NOT NULL DEFAULT 0,
  recording_total INTEGER NOT NULL DEFAULT 0,
  transcription_total INTEGER NOT NULL DEFAULT 0,
  extra_extensions_total INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  payment_gateway TEXT NOT NULL DEFAULT 'mercadopago',
  order_nsu TEXT,
  checkout_url TEXT,
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  paid_at TIMESTAMPTZ,
  provisioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telephony_orders_client_id ON public.telephony_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_telephony_orders_status ON public.telephony_orders(status);
CREATE INDEX IF NOT EXISTS idx_telephony_orders_mp_pref ON public.telephony_orders(mp_preference_id);

ALTER TABLE public.telephony_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view telephony_orders" ON public.telephony_orders FOR SELECT USING (true);
CREATE POLICY "Anyone can insert telephony_orders" ON public.telephony_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update telephony_orders" ON public.telephony_orders FOR UPDATE USING (true) WITH CHECK (true);

CREATE TRIGGER trg_telephony_orders_updated_at
  BEFORE UPDATE ON public.telephony_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_telephony_providers_updated_at();
