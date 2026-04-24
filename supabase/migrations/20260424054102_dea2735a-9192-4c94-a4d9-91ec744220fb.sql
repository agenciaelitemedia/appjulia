-- =========================================================================
-- 1) Colunas de lock pessimista em uazapi_history_items
-- =========================================================================
ALTER TABLE public.uazapi_history_items
  ADD COLUMN IF NOT EXISTS worker_id smallint,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

-- Índice parcial para acelerar SELECT FOR UPDATE SKIP LOCKED em pendências
CREATE INDEX IF NOT EXISTS idx_uazapi_history_items_pending_locked
  ON public.uazapi_history_items (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_uazapi_history_items_pending_run
  ON public.uazapi_history_items (run_id, created_at)
  WHERE status = 'pending';

-- =========================================================================
-- 2) View de fairness: pendências por cliente
-- =========================================================================
CREATE OR REPLACE VIEW public.uazapi_history_pending_by_client AS
SELECT
  r.client_id,
  r.client_name,
  COUNT(i.id)::bigint AS pending_count,
  MIN(i.created_at) AS oldest_pending_at
FROM public.uazapi_history_items i
JOIN public.uazapi_history_runs r ON r.id = i.run_id
WHERE i.status = 'pending'
GROUP BY r.client_id, r.client_name
ORDER BY pending_count DESC;

-- =========================================================================
-- 3) Tabela dispatcher_heartbeat (monitoramento)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.dispatcher_heartbeat (
  id text PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  workers_active smallint NOT NULL DEFAULT 0,
  workers_max smallint NOT NULL DEFAULT 10,
  items_per_min integer NOT NULL DEFAULT 0,
  total_processed_session bigint NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.dispatcher_heartbeat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read dispatcher heartbeat" ON public.dispatcher_heartbeat;
CREATE POLICY "auth read dispatcher heartbeat"
  ON public.dispatcher_heartbeat FOR SELECT
  TO authenticated
  USING (true);

-- service role bypass via SUPABASE_SERVICE_ROLE_KEY (sempre tem acesso)

-- =========================================================================
-- 4) Trigger pg_notify ao inserir item pendente
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_uazapi_history_pending()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  client_id_val text;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT r.client_id::text INTO client_id_val
    FROM public.uazapi_history_runs r
    WHERE r.id = NEW.run_id;

    PERFORM pg_notify('uazapi_history_pending', json_build_object(
      'item_id', NEW.id,
      'run_id', NEW.run_id,
      'client_id', client_id_val
    )::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_uazapi_history_pending ON public.uazapi_history_items;
CREATE TRIGGER trg_notify_uazapi_history_pending
  AFTER INSERT ON public.uazapi_history_items
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_uazapi_history_pending();

-- =========================================================================
-- 5) Adicionar tabela à publication realtime (para postgres_changes)
-- =========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'uazapi_history_items'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.uazapi_history_items';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dispatcher_heartbeat'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatcher_heartbeat';
  END IF;
END $$;

ALTER TABLE public.uazapi_history_items REPLICA IDENTITY FULL;
ALTER TABLE public.dispatcher_heartbeat REPLICA IDENTITY FULL;

-- =========================================================================
-- 6) Função RPC para drenar lote com SKIP LOCKED (chamada pelo worker)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.uazapi_pick_pending_items(
  p_worker_id smallint,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  run_id uuid,
  remote_jid text,
  phone text,
  payload jsonb,
  attempts int
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT i.id
    FROM public.uazapi_history_items i
    WHERE i.status = 'pending'
    ORDER BY i.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.uazapi_history_items u
  SET worker_id = p_worker_id,
      locked_at = now(),
      status = 'pending'  -- mantém pending mas marca lock
  FROM picked
  WHERE u.id = picked.id
  RETURNING u.id, u.run_id, u.remote_jid, u.phone, u.payload, u.attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.uazapi_pick_pending_items(smallint, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.uazapi_pick_pending_items(smallint, int) TO service_role;

-- =========================================================================
-- 7) Função para liberar locks órfãos (lock > 2min sem progresso)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.uazapi_release_stale_locks()
RETURNS int
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  released int;
BEGIN
  WITH r AS (
    UPDATE public.uazapi_history_items
    SET worker_id = NULL, locked_at = NULL
    WHERE status = 'pending'
      AND locked_at IS NOT NULL
      AND locked_at < now() - interval '2 minutes'
    RETURNING 1
  )
  SELECT COUNT(*) INTO released FROM r;
  RETURN released;
END;
$$;

REVOKE ALL ON FUNCTION public.uazapi_release_stale_locks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.uazapi_release_stale_locks() TO service_role;