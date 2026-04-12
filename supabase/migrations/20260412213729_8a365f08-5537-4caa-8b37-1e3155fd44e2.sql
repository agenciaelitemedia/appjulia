ALTER TABLE public.julia_orders ADD COLUMN net_amount integer DEFAULT NULL;
ALTER TABLE public.julia_orders ADD COLUMN fee_amount integer DEFAULT NULL;