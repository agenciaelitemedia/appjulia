CREATE UNIQUE INDEX IF NOT EXISTS idx_xj_deals_client_phone
  ON public.xj_deals (client_id, contact_phone)
  WHERE contact_phone IS NOT NULL;