-- Add due_date to crm_deals for delivery deadline tracking
ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS due_date DATE NULL;

COMMENT ON COLUMN public.crm_deals.due_date IS 'Data de entrega do card. Verde = no prazo, Amarelo = vence hoje, Vermelho = em atraso.';
