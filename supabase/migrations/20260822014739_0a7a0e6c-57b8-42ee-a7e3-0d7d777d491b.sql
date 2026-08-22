CREATE TABLE IF NOT EXISTS public.xj_usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL UNIQUE,
  daily_cost_usd numeric NOT NULL DEFAULT 5,
  monthly_cost_usd numeric NOT NULL DEFAULT 100,
  max_msgs_per_hour_per_lead integer NOT NULL DEFAULT 30,
  max_msgs_per_hour_per_client integer NOT NULL DEFAULT 300,
  on_breach text NOT NULL DEFAULT 'notify_only',
  breach_message text NOT NULL DEFAULT 'Estamos com um volume alto de atendimentos neste momento. Um de nossos atendentes vai continuar com você em breve.',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xj_usage_limits_on_breach_chk CHECK (on_breach IN ('notify_only','pause'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_usage_limits TO authenticated;
GRANT ALL ON public.xj_usage_limits TO service_role;

ALTER TABLE public.xj_usage_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xj_usage_limits_authenticated_all" ON public.xj_usage_limits;
CREATE POLICY "xj_usage_limits_authenticated_all"
  ON public.xj_usage_limits FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.xj_usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  day_brt date NOT NULL,
  cost_usd numeric NOT NULL DEFAULT 0,
  turns integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xj_usage_counters_client_day_uk UNIQUE (client_id, day_brt)
);

GRANT SELECT ON public.xj_usage_counters TO authenticated;
GRANT ALL ON public.xj_usage_counters TO service_role;

ALTER TABLE public.xj_usage_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xj_usage_counters_authenticated_read" ON public.xj_usage_counters;
CREATE POLICY "xj_usage_counters_authenticated_read"
  ON public.xj_usage_counters FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_xj_usage_counters_client_day ON public.xj_usage_counters (client_id, day_brt DESC);

ALTER TABLE public.xj_sessions ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE public.xj_sessions ADD COLUMN IF NOT EXISTS paused_reason text;

CREATE OR REPLACE FUNCTION public.xj_bump_usage(p_client_id text, p_cost_usd numeric, p_turns integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.xj_usage_counters (client_id, day_brt, cost_usd, turns)
  VALUES (p_client_id, (now() AT TIME ZONE 'America/Sao_Paulo')::date, COALESCE(p_cost_usd, 0), COALESCE(p_turns, 0))
  ON CONFLICT (client_id, day_brt) DO UPDATE
    SET cost_usd = public.xj_usage_counters.cost_usd + COALESCE(p_cost_usd, 0),
        turns = public.xj_usage_counters.turns + COALESCE(p_turns, 0),
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.xj_bump_usage(text, numeric, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xj_bump_usage(text, numeric, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.xj_usage_snapshot(p_client_id text)
RETURNS TABLE(day_cost_usd numeric, day_turns integer, month_cost_usd numeric, month_turns bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH d AS (
    SELECT COALESCE(cost_usd, 0) AS c, COALESCE(turns, 0) AS t
    FROM public.xj_usage_counters
    WHERE client_id = p_client_id
      AND day_brt = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  ), m AS (
    SELECT COALESCE(SUM(cost_usd), 0) AS c, COALESCE(SUM(turns), 0) AS t
    FROM public.xj_usage_counters
    WHERE client_id = p_client_id
      AND day_brt >= date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')::date)::date
  )
  SELECT COALESCE((SELECT c FROM d), 0),
         COALESCE((SELECT t FROM d), 0)::integer,
         (SELECT c FROM m),
         (SELECT t FROM m)::bigint;
$$;

REVOKE ALL ON FUNCTION public.xj_usage_snapshot(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xj_usage_snapshot(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.xj_touch_usage_limits()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_xj_usage_limits_touch ON public.xj_usage_limits;
CREATE TRIGGER trg_xj_usage_limits_touch
  BEFORE UPDATE ON public.xj_usage_limits
  FOR EACH ROW EXECUTE FUNCTION public.xj_touch_usage_limits();