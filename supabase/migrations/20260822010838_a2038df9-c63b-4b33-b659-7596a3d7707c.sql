CREATE TABLE IF NOT EXISTS public.xj_inbound_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL,
  message_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  worker_id TEXT,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.xj_inbound_queue TO service_role;
ALTER TABLE public.xj_inbound_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xj_inbound_queue service only" ON public.xj_inbound_queue;
CREATE POLICY "xj_inbound_queue service only"
  ON public.xj_inbound_queue FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS xj_inbound_queue_message_id_uidx
  ON public.xj_inbound_queue (message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS xj_inbound_queue_due_idx
  ON public.xj_inbound_queue (status, run_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS xj_inbound_queue_locked_idx
  ON public.xj_inbound_queue (status, locked_at) WHERE status = 'processing';

DROP TRIGGER IF EXISTS xj_inbound_queue_touch ON public.xj_inbound_queue;
CREATE TRIGGER xj_inbound_queue_touch
  BEFORE UPDATE ON public.xj_inbound_queue
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();

CREATE OR REPLACE FUNCTION public.xj_pick_inbound(p_worker_id TEXT, p_limit INTEGER DEFAULT 20)
RETURNS SETOF public.xj_inbound_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT q.id
      FROM public.xj_inbound_queue q
     WHERE q.status = 'pending'
       AND q.run_at <= now()
     ORDER BY q.run_at
     LIMIT GREATEST(COALESCE(p_limit, 20), 1)
       FOR UPDATE SKIP LOCKED
  )
  UPDATE public.xj_inbound_queue u
     SET status = 'processing',
         locked_at = now(),
         worker_id = p_worker_id,
         attempts = u.attempts + 1
   WHERE u.id IN (SELECT id FROM picked)
  RETURNING u.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.xj_release_stale_inbound(p_minutes INTEGER DEFAULT 5)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH stale AS (
    SELECT id, attempts, max_attempts
      FROM public.xj_inbound_queue
     WHERE status = 'processing'
       AND locked_at < now() - make_interval(mins => GREATEST(COALESCE(p_minutes, 5), 1))
  )
  UPDATE public.xj_inbound_queue u
     SET status = CASE WHEN s.attempts >= s.max_attempts THEN 'dead' ELSE 'pending' END,
         locked_at = NULL,
         worker_id = NULL,
         run_at = now(),
         error_message = COALESCE(u.error_message, 'processamento interrompido (lock expirado)')
    FROM stale s
   WHERE u.id = s.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.xj_pick_inbound(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xj_release_stale_inbound(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xj_pick_inbound(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.xj_release_stale_inbound(INTEGER) TO service_role;