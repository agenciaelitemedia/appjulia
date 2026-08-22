ALTER TABLE public.xj_followups
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS worker_id smallint,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_xj_followups_pending ON public.xj_followups (status, run_at);

CREATE OR REPLACE FUNCTION public.xj_pick_due_followups(p_worker_id smallint DEFAULT 1, p_limit integer DEFAULT 100)
RETURNS SETOF public.xj_followups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.xj_followups
    WHERE status = 'pending'
      AND run_at <= now()
    ORDER BY run_at
    LIMIT GREATEST(1, LEAST(p_limit, 500))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.xj_followups f
     SET status = 'processing',
         locked_at = now(),
         worker_id = p_worker_id,
         updated_at = now()
    FROM picked
   WHERE f.id = picked.id
  RETURNING f.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.xj_release_stale_followups(p_minutes integer DEFAULT 5)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.xj_followups
     SET status = 'pending',
         locked_at = NULL,
         worker_id = NULL,
         updated_at = now()
   WHERE status = 'processing'
     AND locked_at IS NOT NULL
     AND locked_at < now() - make_interval(mins => GREATEST(1, p_minutes));
  SELECT count(*) INTO v_count FROM public.xj_followups WHERE status = 'pending' AND run_at <= now();
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.xj_pick_due_followups(smallint, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.xj_release_stale_followups(integer) TO service_role;