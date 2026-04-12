
-- Add columns to julia_orders for Mercado Pago support
ALTER TABLE public.julia_orders
  ADD COLUMN payment_gateway text NOT NULL DEFAULT 'infinitypay',
  ADD COLUMN mp_preference_id text,
  ADD COLUMN mp_payment_id text;

-- Create payment config table
CREATE TABLE public.julia_payment_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gateway text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_sandbox boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (gateway)
);

ALTER TABLE public.julia_payment_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access julia_payment_config"
  ON public.julia_payment_config
  FOR ALL
  USING (true)
  WITH CHECK (true);
