
-- =====================================================
-- Queue plans: catálogo gerenciado pelo admin
-- =====================================================
CREATE TABLE public.queue_plans (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  max_queues INTEGER NOT NULL DEFAULT 1,
  extra_queue_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_quarterly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_semiannual NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_annual NUMERIC(10,2) NOT NULL DEFAULT 0,
  setup_fee_monthly NUMERIC(10,2),
  setup_fee_quarterly NUMERIC(10,2),
  setup_fee_semiannual NUMERIC(10,2),
  setup_fee_annual NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.queue_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_plans readable by authenticated"
  ON public.queue_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "queue_plans manageable by authenticated"
  ON public.queue_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER queue_plans_set_updated_at
  BEFORE UPDATE ON public.queue_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_module_embeds_updated_at();

-- =====================================================
-- Queue user plans: vínculo cliente → plano
-- =====================================================
CREATE TABLE public.queue_user_plans (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT,
  cod_agent BIGINT,
  plan_id BIGINT NOT NULL REFERENCES public.queue_plans(id) ON DELETE RESTRICT,
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  extra_queues INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  client_name TEXT,
  business_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_queue_user_plans_client ON public.queue_user_plans(client_id);
CREATE INDEX idx_queue_user_plans_active ON public.queue_user_plans(is_active);

ALTER TABLE public.queue_user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_user_plans readable by authenticated"
  ON public.queue_user_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "queue_user_plans manageable by authenticated"
  ON public.queue_user_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER queue_user_plans_set_updated_at
  BEFORE UPDATE ON public.queue_user_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_module_embeds_updated_at();

-- =====================================================
-- Queue orders: pedidos de contratação
-- =====================================================
CREATE TABLE public.queue_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_document TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_whatsapp TEXT,
  plan_id BIGINT NOT NULL,
  plan_name TEXT NOT NULL,
  billing_period TEXT NOT NULL,
  extra_queues INTEGER NOT NULL DEFAULT 0,
  plan_price INTEGER NOT NULL DEFAULT 0,
  setup_fee INTEGER NOT NULL DEFAULT 0,
  extra_queues_total INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  payment_gateway TEXT NOT NULL DEFAULT 'mercadopago',
  order_nsu TEXT,
  checkout_url TEXT,
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  paid_amount INTEGER,
  net_amount INTEGER,
  fee_amount INTEGER,
  paid_at TIMESTAMPTZ,
  provisioned_at TIMESTAMPTZ,
  provisioning_error TEXT,
  user_plan_id BIGINT,
  webhook_payload JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_queue_orders_client_id ON public.queue_orders(client_id);
CREATE INDEX idx_queue_orders_status ON public.queue_orders(status);
CREATE INDEX idx_queue_orders_mp_pref ON public.queue_orders(mp_preference_id);

ALTER TABLE public.queue_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert queue_orders"
  ON public.queue_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update queue_orders"
  ON public.queue_orders FOR UPDATE USING (true);
CREATE POLICY "Anyone can read queue_orders"
  ON public.queue_orders FOR SELECT USING (true);

CREATE TRIGGER queue_orders_set_updated_at
  BEFORE UPDATE ON public.queue_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_module_embeds_updated_at();
