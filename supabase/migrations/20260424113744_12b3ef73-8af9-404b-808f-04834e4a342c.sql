-- Corrige RPC de pick para marcar status='processing' e exigir worker_id IS NULL
CREATE OR REPLACE FUNCTION public.uazapi_pick_pending_items(p_worker_id smallint, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, run_id uuid, remote_jid text, phone text, payload jsonb, attempts integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT i.id
    FROM public.uazapi_history_items i
    WHERE i.status = 'pending'
      AND i.worker_id IS NULL
    ORDER BY i.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.uazapi_history_items u
  SET worker_id = p_worker_id,
      locked_at = now(),
      status = 'processing'
  FROM picked
  WHERE u.id = picked.id
  RETURNING u.id, u.run_id, u.remote_jid, u.phone, u.payload, u.attempts;
END;
$function$;

-- Atualiza release de locks: cobre tanto pending com lock antigo quanto processing parado
CREATE OR REPLACE FUNCTION public.uazapi_release_stale_locks()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  released int;
BEGIN
  WITH r AS (
    UPDATE public.uazapi_history_items
    SET worker_id = NULL,
        locked_at = NULL,
        status = 'pending'
    WHERE status IN ('pending', 'processing')
      AND locked_at IS NOT NULL
      AND locked_at < now() - interval '2 minutes'
    RETURNING 1
  )
  SELECT COUNT(*) INTO released FROM r;
  RETURN released;
END;
$function$;

-- Índice parcial para acelerar o pick
CREATE INDEX IF NOT EXISTS idx_uazapi_history_items_pick
  ON public.uazapi_history_items (created_at)
  WHERE status = 'pending' AND worker_id IS NULL;

-- Recovery: libera todos os locks órfãos atuais
UPDATE public.uazapi_history_items
SET worker_id = NULL,
    locked_at = NULL,
    status = 'pending'
WHERE status IN ('pending', 'processing')
  AND locked_at IS NOT NULL;