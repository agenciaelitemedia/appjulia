-- 1) Fila de entrada: índice parcial cobrindo o predicado + ordenação do worker
CREATE INDEX IF NOT EXISTS chat_inbound_queue_pending_order_idx
  ON public.chat_inbound_queue (next_attempt_at, created_at)
  WHERE status = 'pending';

-- 2) CRM: índice para lista filtrada por escritório/situação ordenada por criação
CREATE INDEX IF NOT EXISTS idx_crm_deals_client_status_created
  ON public.crm_deals (client_id, status, created_at DESC);

-- 3) Contagem de atendimentos por atendente calculada no banco
CREATE OR REPLACE FUNCTION public.chat_assigned_counts_by_member(p_client_id text)
RETURNS TABLE(assigned_to text, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.assigned_to, count(*)::bigint
  FROM public.chat_conversations c
  WHERE c.client_id = p_client_id
    AND c.status IN ('open', 'pending')
    AND c.assigned_to IS NOT NULL
    AND btrim(c.assigned_to) <> ''
  GROUP BY c.assigned_to
$$;

GRANT EXECUTE ON FUNCTION public.chat_assigned_counts_by_member(text) TO anon, authenticated, service_role;

-- 4) Limpeza automática diária da fila e das tabelas de log
SELECT cron.schedule(
  'chat-inbound-queue-cleanup-daily',
  '40 4 * * *',
  $$
  DELETE FROM public.chat_inbound_queue
  WHERE status = 'done'
    AND coalesce(processed_at, created_at) < now() - interval '3 days';
  $$
);

SELECT cron.schedule(
  'chat-log-tables-cleanup-daily',
  '50 4 * * *',
  $$
  DELETE FROM public.chat_dropped_messages WHERE created_at < now() - interval '60 days';
  $$
);

SELECT cron.schedule(
  'webhook-logs-cleanup-daily',
  '55 4 * * *',
  $$
  DELETE FROM public.webhook_logs WHERE created_at < now() - interval '60 days';
  $$
);