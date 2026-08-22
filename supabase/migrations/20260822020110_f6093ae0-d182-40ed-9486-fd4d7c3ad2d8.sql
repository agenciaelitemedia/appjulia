CREATE TABLE IF NOT EXISTS public.xj_analytics_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id text NOT NULL,
  day date NOT NULL,
  sessions_started integer NOT NULL DEFAULT 0,
  sessions_touched integer NOT NULL DEFAULT 0,
  turns integer NOT NULL DEFAULT 0,
  prompt_tokens bigint NOT NULL DEFAULT 0,
  completion_tokens bigint NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  qualified integer NOT NULL DEFAULT 0,
  disqualified integer NOT NULL DEFAULT 0,
  handoffs integer NOT NULL DEFAULT 0,
  deals_created integer NOT NULL DEFAULT 0,
  contracts_sent integer NOT NULL DEFAULT 0,
  followups_sent integer NOT NULL DEFAULT 0,
  llm_errors integer NOT NULL DEFAULT 0,
  circuit_breaks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS xj_analytics_daily_client_day_uidx
  ON public.xj_analytics_daily (client_id, day);

GRANT SELECT ON public.xj_analytics_daily TO authenticated;
GRANT ALL ON public.xj_analytics_daily TO service_role;

ALTER TABLE public.xj_analytics_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xj_analytics_daily_read" ON public.xj_analytics_daily;
CREATE POLICY "xj_analytics_daily_read"
  ON public.xj_analytics_daily FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS xj_analytics_daily_touch ON public.xj_analytics_daily;
CREATE TRIGGER xj_analytics_daily_touch
  BEFORE UPDATE ON public.xj_analytics_daily
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();

CREATE OR REPLACE FUNCTION public.xj_rollup_analytics_daily(p_day date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date := COALESCE(p_day, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_rows integer := 0;
BEGIN
  WITH sess AS (
    SELECT s.client_id,
           COUNT(*) FILTER (WHERE (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_day) AS sessions_started,
           COUNT(*) AS sessions_touched,
           COALESCE(SUM(s.turns), 0) AS turns,
           COUNT(*) FILTER (WHERE s.qualification = 'qualified') AS qualified,
           COUNT(*) FILTER (WHERE s.qualification = 'disqualified') AS disqualified,
           COUNT(*) FILTER (WHERE s.handoff_at IS NOT NULL
                              AND (s.handoff_at AT TIME ZONE 'America/Sao_Paulo')::date = v_day) AS handoffs
      FROM public.xj_sessions s
     WHERE (s.updated_at AT TIME ZONE 'America/Sao_Paulo')::date = v_day
     GROUP BY s.client_id
  ), ev AS (
    SELECT e.client_id,
           COALESCE(SUM(e.prompt_tokens), 0) AS prompt_tokens,
           COALESCE(SUM(e.completion_tokens), 0) AS completion_tokens,
           COALESCE(SUM(e.cost), 0) AS cost_usd,
           COUNT(*) FILTER (WHERE e.status = 'error') AS llm_errors,
           COUNT(*) FILTER (WHERE e.kind = 'circuit_breaker') AS circuit_breaks,
           COUNT(*) FILTER (WHERE e.kind IN ('contract_sent', 'zapsign_sent')) AS contracts_sent
      FROM public.xj_session_events e
     WHERE (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_day
     GROUP BY e.client_id
  ), dl AS (
    SELECT d.client_id, COUNT(*) AS deals_created
      FROM public.xj_deals d
     WHERE (d.created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_day
     GROUP BY d.client_id
  ), fu AS (
    SELECT f.client_id, COUNT(*) AS followups_sent
      FROM public.xj_followups f
     WHERE f.status = 'sent'
       AND f.sent_at IS NOT NULL
       AND (f.sent_at AT TIME ZONE 'America/Sao_Paulo')::date = v_day
     GROUP BY f.client_id
  ), keys AS (
    SELECT client_id FROM sess
    UNION SELECT client_id FROM ev
    UNION SELECT client_id FROM dl
    UNION SELECT client_id FROM fu
  )
  INSERT INTO public.xj_analytics_daily AS t (
    client_id, day, sessions_started, sessions_touched, turns,
    prompt_tokens, completion_tokens, cost_usd, qualified, disqualified,
    handoffs, deals_created, contracts_sent, followups_sent, llm_errors, circuit_breaks
  )
  SELECT k.client_id, v_day,
         COALESCE(s.sessions_started, 0), COALESCE(s.sessions_touched, 0), COALESCE(s.turns, 0),
         COALESCE(e.prompt_tokens, 0), COALESCE(e.completion_tokens, 0), COALESCE(e.cost_usd, 0),
         COALESCE(s.qualified, 0), COALESCE(s.disqualified, 0), COALESCE(s.handoffs, 0),
         COALESCE(d.deals_created, 0), COALESCE(e.contracts_sent, 0), COALESCE(f.followups_sent, 0),
         COALESCE(e.llm_errors, 0), COALESCE(e.circuit_breaks, 0)
    FROM keys k
    LEFT JOIN sess s ON s.client_id = k.client_id
    LEFT JOIN ev e ON e.client_id = k.client_id
    LEFT JOIN dl d ON d.client_id = k.client_id
    LEFT JOIN fu f ON f.client_id = k.client_id
   WHERE k.client_id IS NOT NULL
  ON CONFLICT (client_id, day) DO UPDATE SET
    sessions_started = EXCLUDED.sessions_started,
    sessions_touched = EXCLUDED.sessions_touched,
    turns = EXCLUDED.turns,
    prompt_tokens = EXCLUDED.prompt_tokens,
    completion_tokens = EXCLUDED.completion_tokens,
    cost_usd = EXCLUDED.cost_usd,
    qualified = EXCLUDED.qualified,
    disqualified = EXCLUDED.disqualified,
    handoffs = EXCLUDED.handoffs,
    deals_created = EXCLUDED.deals_created,
    contracts_sent = EXCLUDED.contracts_sent,
    followups_sent = EXCLUDED.followups_sent,
    llm_errors = EXCLUDED.llm_errors,
    circuit_breaks = EXCLUDED.circuit_breaks,
    updated_at = now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.xj_retention_cleanup(
  p_queue_done_days integer DEFAULT 7,
  p_dlq_days integer DEFAULT 30,
  p_events_days integer DEFAULT 90,
  p_followups_days integer DEFAULT 120
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue integer := 0;
  v_dlq integer := 0;
  v_events integer := 0;
  v_followups integer := 0;
BEGIN
  DELETE FROM public.xj_inbound_queue
   WHERE status = 'done'
     AND COALESCE(processed_at, updated_at, created_at) < now() - make_interval(days => GREATEST(p_queue_done_days, 1));
  GET DIAGNOSTICS v_queue = ROW_COUNT;

  DELETE FROM public.xj_inbound_queue
   WHERE status IN ('dlq', 'failed')
     AND COALESCE(updated_at, created_at) < now() - make_interval(days => GREATEST(p_dlq_days, 1));
  GET DIAGNOSTICS v_dlq = ROW_COUNT;

  DELETE FROM public.xj_session_events
   WHERE created_at < now() - make_interval(days => GREATEST(p_events_days, 7));
  GET DIAGNOSTICS v_events = ROW_COUNT;

  DELETE FROM public.xj_followups
   WHERE status IN ('sent', 'cancelled', 'skipped', 'error')
     AND COALESCE(sent_at, updated_at, created_at) < now() - make_interval(days => GREATEST(p_followups_days, 30));
  GET DIAGNOSTICS v_followups = ROW_COUNT;

  RETURN jsonb_build_object(
    'queue_done_deleted', v_queue,
    'dlq_deleted', v_dlq,
    'session_events_deleted', v_events,
    'followups_deleted', v_followups
  );
END;
$$;

REVOKE ALL ON FUNCTION public.xj_rollup_analytics_daily(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xj_retention_cleanup(integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.xj_rollup_analytics_daily(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.xj_retention_cleanup(integer, integer, integer, integer) TO service_role;