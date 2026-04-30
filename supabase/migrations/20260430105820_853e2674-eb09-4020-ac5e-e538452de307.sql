ALTER TABLE public.telephony_orders ADD COLUMN IF NOT EXISTS metadata jsonb;
CREATE INDEX IF NOT EXISTS idx_telephony_orders_metadata ON public.telephony_orders USING gin (metadata);