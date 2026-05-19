
-- 1.1 video_plans
CREATE TABLE public.video_plans (
  id serial PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE,
  included_minutes integer NOT NULL DEFAULT 0,
  max_concurrent_rooms integer NOT NULL DEFAULT 1,
  recording_included boolean NOT NULL DEFAULT false,
  transcription_included boolean NOT NULL DEFAULT false,
  price_monthly numeric NOT NULL DEFAULT 0,
  price_quarterly numeric NOT NULL DEFAULT 0,
  price_semiannual numeric NOT NULL DEFAULT 0,
  price_annual numeric NOT NULL DEFAULT 0,
  extra_minutes_pack_size integer NOT NULL DEFAULT 1000,
  extra_minutes_pack_price numeric NOT NULL DEFAULT 0,
  recording_addon_price numeric NOT NULL DEFAULT 99.90,
  transcription_addon_price numeric NOT NULL DEFAULT 99.90,
  setup_fee_monthly numeric,
  setup_fee_quarterly numeric,
  setup_fee_semiannual numeric,
  setup_fee_annual numeric,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on video_plans" ON public.video_plans USING (true) WITH CHECK (true);

CREATE TRIGGER trg_video_plans_updated_at
  BEFORE UPDATE ON public.video_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_module_embeds_updated_at();

-- 1.2 video_orders
CREATE TABLE public.video_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  customer_name text NOT NULL,
  customer_document text NOT NULL,
  customer_email text NOT NULL,
  customer_whatsapp text,
  plan_id integer NOT NULL REFERENCES public.video_plans(id),
  plan_name text NOT NULL,
  billing_period text NOT NULL,
  extra_minute_packs integer NOT NULL DEFAULT 0,
  recording_enabled boolean NOT NULL DEFAULT false,
  transcription_enabled boolean NOT NULL DEFAULT false,
  plan_price integer NOT NULL DEFAULT 0,
  setup_fee integer NOT NULL DEFAULT 0,
  recording_total integer NOT NULL DEFAULT 0,
  transcription_total integer NOT NULL DEFAULT 0,
  extras_total integer NOT NULL DEFAULT 0,
  total_amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  payment_gateway text NOT NULL DEFAULT 'mercadopago',
  order_nsu text,
  checkout_url text,
  mp_preference_id text,
  mp_payment_id text,
  paid_at timestamptz,
  provisioned_at timestamptz,
  paid_amount integer,
  net_amount integer,
  fee_amount integer,
  provisioning_error text,
  metadata jsonb,
  webhook_payload jsonb,
  user_plan_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_orders_client_id ON public.video_orders(client_id);
CREATE INDEX idx_video_orders_status ON public.video_orders(status);
CREATE INDEX idx_video_orders_mp_pref ON public.video_orders(mp_preference_id);
CREATE INDEX idx_video_orders_metadata ON public.video_orders USING GIN(metadata);

ALTER TABLE public.video_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can select video_orders" ON public.video_orders FOR SELECT USING (true);
CREATE POLICY "Anyone can insert video_orders" ON public.video_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update video_orders" ON public.video_orders FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete video_orders" ON public.video_orders FOR DELETE USING (true);

CREATE TRIGGER trg_video_orders_updated_at
  BEFORE UPDATE ON public.video_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_module_embeds_updated_at();

-- 1.3 video_user_plans
CREATE TABLE public.video_user_plans (
  id bigserial PRIMARY KEY,
  client_id text NOT NULL,
  plan_id integer NOT NULL REFERENCES public.video_plans(id),
  billing_period text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  minutes_quota integer NOT NULL DEFAULT 0,
  minutes_used integer NOT NULL DEFAULT 0,
  max_concurrent_rooms integer NOT NULL DEFAULT 1,
  recording_enabled boolean NOT NULL DEFAULT false,
  transcription_enabled boolean NOT NULL DEFAULT false,
  period_start timestamptz NOT NULL DEFAULT now(),
  period_end timestamptz NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_user_plans_client_id ON public.video_user_plans(client_id);
CREATE INDEX idx_video_user_plans_status ON public.video_user_plans(status);
CREATE INDEX idx_video_user_plans_period_end ON public.video_user_plans(period_end);

ALTER TABLE public.video_user_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can select video_user_plans" ON public.video_user_plans FOR SELECT USING (true);
CREATE POLICY "Anyone can insert video_user_plans" ON public.video_user_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update video_user_plans" ON public.video_user_plans FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete video_user_plans" ON public.video_user_plans FOR DELETE USING (true);

CREATE TRIGGER trg_video_user_plans_updated_at
  BEFORE UPDATE ON public.video_user_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_module_embeds_updated_at();

-- 1.4 Seed dos 3 planos sugeridos
INSERT INTO public.video_plans
  (name, slug, included_minutes, max_concurrent_rooms,
   recording_included, transcription_included,
   price_monthly, price_quarterly, price_semiannual, price_annual,
   extra_minutes_pack_size, extra_minutes_pack_price,
   recording_addon_price, transcription_addon_price,
   setup_fee_monthly, setup_fee_quarterly, setup_fee_semiannual, setup_fee_annual,
   description, is_active, sort_order)
VALUES
  ('Light', 'light', 5000, 2, false, false,
   197.00, 561.00, 1064.00, 1999.00,
   1000, 49.00, 99.90, 99.90,
   0, 0, 0, 0,
   'Ideal para escritórios pequenos que estão começando com videochamadas. Até 2 salas simultâneas e 5.000 minutos/mês.',
   true, 1),
  ('Pro', 'pro', 20000, 5, false, false,
   497.00, 1416.00, 2685.00, 5069.00,
   1000, 39.00, 99.90, 99.90,
   0, 0, 0, 0,
   'Para times médios. Até 5 salas simultâneas, 20.000 minutos/mês e add-ons opcionais de gravação e transcrição.',
   true, 2),
  ('Escritório', 'office', 50000, 15, true, true,
   1197.00, 3411.00, 6464.00, 12205.00,
   1000, 29.00, 0, 0,
   0, 0, 0, 0,
   'Para escritórios maiores. Até 15 salas simultâneas, 50.000 minutos/mês com gravação e transcrição inclusas.',
   true, 3);
