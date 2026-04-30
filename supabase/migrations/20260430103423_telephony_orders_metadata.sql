-- Adiciona coluna metadata para registrar divergências de preço (cliente x servidor)
-- e qualquer outro dado auxiliar futuro do pedido de telefonia.
ALTER TABLE public.telephony_orders
  ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE INDEX IF NOT EXISTS telephony_orders_metadata_price_divergence_idx
  ON public.telephony_orders ((metadata -> 'price_divergence'))
  WHERE metadata ? 'price_divergence';
