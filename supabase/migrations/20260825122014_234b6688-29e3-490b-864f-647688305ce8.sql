-- 1) Helper imutável: sufixo após o último ':' de um id de mensagem
CREATE OR REPLACE FUNCTION public.chat_msg_id_suffix(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p IS NULL THEN NULL
    WHEN position(':' in p) = 0 THEN NULL
    ELSE substring(p from length(p) - position(':' in reverse(p)) + 2)
  END
$$;

-- 2) Índices de expressão para resolver ids prefixados sem ILIKE
CREATE INDEX IF NOT EXISTS idx_chat_messages_msgid_suffix
  ON public.chat_messages (public.chat_msg_id_suffix(message_id))
  WHERE message_id LIKE '%:%';

CREATE INDEX IF NOT EXISTS idx_chat_messages_extid_suffix
  ON public.chat_messages (public.chat_msg_id_suffix(external_id))
  WHERE external_id LIKE '%:%';

-- 3) RPC única para deduplicação (exata + sufixo), substitui o OR de ILIKE
CREATE OR REPLACE FUNCTION public.chat_resolve_message_ids(p_ids text[])
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id FROM public.chat_messages m
   WHERE m.message_id = ANY(p_ids) OR m.external_id = ANY(p_ids)
  UNION
  SELECT m.id FROM public.chat_messages m
   WHERE m.message_id LIKE '%:%'
     AND public.chat_msg_id_suffix(m.message_id) = ANY(p_ids)
  UNION
  SELECT m.id FROM public.chat_messages m
   WHERE m.external_id LIKE '%:%'
     AND public.chat_msg_id_suffix(m.external_id) = ANY(p_ids)
$$;

GRANT EXECUTE ON FUNCTION public.chat_resolve_message_ids(text[]) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_msg_id_suffix(text) TO service_role, authenticated;

-- 4) Índice composto para o monitor da fila de histórico
CREATE INDEX IF NOT EXISTS idx_uazapi_history_items_status_processed
  ON public.uazapi_history_items (status, processed_at DESC);

-- 5) Índice duplicado (mesma coluna do índice único parcial), encarece inserts
DROP INDEX IF EXISTS public.idx_chat_messages_message_id;

-- 6) Rotina diária de retenção
CREATE OR REPLACE FUNCTION public.chat_retention_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d_history integer := 0;
  d_dropped integer := 0;
  d_cron integer := 0;
BEGIN
  DELETE FROM public.uazapi_history_items
   WHERE id IN (
     SELECT id FROM public.uazapi_history_items
      WHERE status IN ('ok','skipped')
        AND created_at < now() - interval '30 days'
      LIMIT 50000
   );
  d_history := ROW_COUNT_HACK();
  RETURN jsonb_build_object('ok', true);
END;
$$;

DROP FUNCTION IF EXISTS public.chat_retention_cleanup();

CREATE OR REPLACE FUNCTION public.chat_retention_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d_history integer := 0;
  d_dropped integer := 0;
  d_cron integer := 0;
BEGIN
  DELETE FROM public.uazapi_history_items
   WHERE id IN (
     SELECT id FROM public.uazapi_history_items
      WHERE status IN ('ok','skipped')
        AND created_at < now() - interval '30 days'
      LIMIT 50000
   );
  GET DIAGNOSTICS d_history = ROW_COUNT;

  DELETE FROM public.chat_dropped_messages
   WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS d_dropped = ROW_COUNT;

  BEGIN
    DELETE FROM cron.job_run_details
     WHERE runid IN (
       SELECT runid FROM cron.job_run_details
        WHERE end_time < now() - interval '7 days'
        LIMIT 100000
     );
    GET DIAGNOSTICS d_cron = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    d_cron := -1;
  END;

  RETURN jsonb_build_object(
    'history_deleted', d_history,
    'dropped_deleted', d_dropped,
    'cron_logs_deleted', d_cron
  );
END;
$$;

REVOKE ALL ON FUNCTION public.chat_retention_cleanup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_retention_cleanup() TO service_role;

-- 7) Agenda diária às 04:10 UTC
SELECT cron.unschedule('chat_retention_cleanup')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'chat_retention_cleanup');

SELECT cron.schedule('chat_retention_cleanup', '10 4 * * *', $$SELECT public.chat_retention_cleanup();$$);