CREATE TABLE public.julia_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_document text NOT NULL,
  customer_address text NOT NULL DEFAULT '',
  customer_email text NOT NULL DEFAULT '',
  customer_whatsapp text NOT NULL DEFAULT '',
  plan_name text NOT NULL DEFAULT '',
  plan_price integer NOT NULL DEFAULT 0,
  billing_period text DEFAULT 'monthly',
  status text NOT NULL DEFAULT 'draft',
  order_nsu text UNIQUE,
  checkout_url text,
  infinitypay_transaction_nsu text,
  receipt_url text,
  paid_amount integer,
  installments integer,
  webhook_payload jsonb,
  cod_agent text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

ALTER TABLE public.julia_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access julia_orders" ON public.julia_orders FOR ALL USING (true) WITH CHECK (true);