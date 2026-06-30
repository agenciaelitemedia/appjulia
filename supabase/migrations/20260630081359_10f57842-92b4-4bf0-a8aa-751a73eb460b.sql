CREATE TABLE public.wavoip_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  monthly_price numeric(10,2) NOT NULL DEFAULT 0,
  included_minutes integer NOT NULL DEFAULT 0,
  max_devices integer NOT NULL DEFAULT 1,
  device_model text NOT NULL DEFAULT 'free',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wavoip_plans TO anon, authenticated;
GRANT ALL ON public.wavoip_plans TO service_role;
ALTER TABLE public.wavoip_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wavoip_plans_all" ON public.wavoip_plans FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.wavoip_user_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.wavoip_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',
  activated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wavoip_user_plans TO anon, authenticated;
GRANT ALL ON public.wavoip_user_plans TO service_role;
ALTER TABLE public.wavoip_user_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wavoip_user_plans_all" ON public.wavoip_user_plans FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.wavoip_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid REFERENCES public.wavoip_plans(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_provider text,
  payment_id text,
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wavoip_orders TO anon, authenticated;
GRANT ALL ON public.wavoip_orders TO service_role;
ALTER TABLE public.wavoip_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wavoip_orders_all" ON public.wavoip_orders FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.wavoip_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_plan_id uuid REFERENCES public.wavoip_user_plans(id) ON DELETE CASCADE,
  device_token text NOT NULL,
  device_name text,
  whatsapp_number text,
  whatsapp_jid text,
  status text NOT NULL DEFAULT 'pending',
  device_model text NOT NULL DEFAULT 'free',
  last_seen_at timestamptz,
  provisioned_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX wavoip_devices_token_uidx ON public.wavoip_devices(device_token);
CREATE INDEX wavoip_devices_user_idx ON public.wavoip_devices(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wavoip_devices TO anon, authenticated;
GRANT ALL ON public.wavoip_devices TO service_role;
ALTER TABLE public.wavoip_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wavoip_devices_all" ON public.wavoip_devices FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.wavoip_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  device_id uuid REFERENCES public.wavoip_devices(id) ON DELETE SET NULL,
  conversation_id uuid,
  contact_id uuid,
  direction text NOT NULL,
  status text NOT NULL,
  from_number text,
  to_number text,
  whatsapp_jid text,
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0,
  end_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wavoip_call_logs_user_idx ON public.wavoip_call_logs(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wavoip_call_logs TO anon, authenticated;
GRANT ALL ON public.wavoip_call_logs TO service_role;
ALTER TABLE public.wavoip_call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wavoip_call_logs_all" ON public.wavoip_call_logs FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_wavoip_plans_updated BEFORE UPDATE ON public.wavoip_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
CREATE TRIGGER trg_wavoip_user_plans_updated BEFORE UPDATE ON public.wavoip_user_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
CREATE TRIGGER trg_wavoip_orders_updated BEFORE UPDATE ON public.wavoip_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
CREATE TRIGGER trg_wavoip_devices_updated BEFORE UPDATE ON public.wavoip_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

INSERT INTO public.wavoip_plans (name, description, monthly_price, included_minutes, max_devices, device_model, sort_order)
VALUES ('Wavoip Free', 'Plano básico Wavoip com 1 dispositivo', 0, 0, 1, 'free', 1);