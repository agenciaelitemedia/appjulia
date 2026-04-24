-- Índice composto que cobre exatamente a query do drain worker
-- (status='pending', attempts<5, ordered by created_at)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uazapi_history_items_drain
  ON public.uazapi_history_items (created_at ASC)
  WHERE status = 'pending' AND attempts < 5;
