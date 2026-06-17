
-- =========================================================
-- 1) Recria user_presence_heartbeats como tabela particionada por mês
-- =========================================================
DROP TABLE IF EXISTS public.user_presence_heartbeats CASCADE;

CREATE TABLE public.user_presence_heartbeats (
  user_id    bigint      NOT NULL,
  client_id  bigint      NOT NULL,
  seen_at    timestamptz NOT NULL,
  PRIMARY KEY (user_id, seen_at)
) PARTITION BY RANGE (seen_at);

GRANT SELECT, INSERT ON public.user_presence_heartbeats TO authenticated;
GRANT ALL            ON public.user_presence_heartbeats TO service_role;

ALTER TABLE public.user_presence_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uph_service_all" ON public.user_presence_heartbeats;
CREATE POLICY "uph_service_all"
  ON public.user_presence_heartbeats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =========================================================
-- 2) Função para criar partições futuras (idempotente)
-- =========================================================
CREATE OR REPLACE FUNCTION public.ensure_user_presence_partitions(
  p_months_ahead integer DEFAULT 3
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_i        integer;
  v_start    date;
  v_end      date;
  v_name     text;
  v_created  integer := 0;
BEGIN
  FOR v_i IN 0..GREATEST(p_months_ahead, 0) LOOP
    v_start := date_trunc('month', (now() AT TIME ZONE 'UTC')::date) + (v_i || ' months')::interval;
    v_end   := v_start + interval '1 month';
    v_name  := format('user_presence_heartbeats_%s', to_char(v_start, 'YYYYMM'));

    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = v_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.user_presence_heartbeats
           FOR VALUES FROM (%L) TO (%L)',
        v_name, v_start::timestamptz, v_end::timestamptz
      );
      -- BRIN é ~1000x menor que B-tree e ideal para append-only ordenado por tempo.
      EXECUTE format(
        'CREATE INDEX %I ON public.%I USING brin (seen_at) WITH (pages_per_range = 32)',
        v_name || '_seen_brin', v_name
      );
      -- Índice para o dashboard agregado por cliente.
      EXECUTE format(
        'CREATE INDEX %I ON public.%I (client_id, seen_at DESC)',
        v_name || '_client_seen', v_name
      );
      v_created := v_created + 1;
    END IF;
  END LOOP;

  RETURN v_created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_presence_partitions(integer) TO service_role;

-- Cria mês atual + 3 futuros agora.
SELECT public.ensure_user_presence_partitions(3);

-- =========================================================
-- 3) Drop de partições antigas (retenção de 90 dias - rápido, sem DELETE)
-- =========================================================
CREATE OR REPLACE FUNCTION public.cleanup_user_presence_heartbeats(
  p_retention_days integer DEFAULT 90
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff date := (now() AT TIME ZONE 'UTC')::date - (p_retention_days || ' days')::interval;
  v_rec    record;
  v_dropped integer := 0;
  v_month_str text;
  v_part_end  date;
BEGIN
  FOR v_rec IN
    SELECT c.relname
      FROM pg_inherits i
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_namespace n ON n.oid = p.relnamespace
     WHERE n.nspname = 'public'
       AND p.relname = 'user_presence_heartbeats'
  LOOP
    v_month_str := regexp_replace(v_rec.relname, '^user_presence_heartbeats_', '');
    BEGIN
      v_part_end := to_date(v_month_str, 'YYYYMM') + interval '1 month';
    EXCEPTION WHEN others THEN
      CONTINUE; -- nome fora do padrão
    END;

    -- Só dropa quando TODA a partição já passou da janela de retenção.
    IF v_part_end <= v_cutoff THEN
      EXECUTE format('DROP TABLE public.%I', v_rec.relname);
      v_dropped := v_dropped + 1;
    END IF;
  END LOOP;

  RETURN v_dropped;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_user_presence_heartbeats(integer) TO service_role;
-- compat: assinatura antiga sem parâmetros
CREATE OR REPLACE FUNCTION public.cleanup_user_presence_heartbeats()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.cleanup_user_presence_heartbeats(90);
$$;
GRANT EXECUTE ON FUNCTION public.cleanup_user_presence_heartbeats() TO service_role;

-- =========================================================
-- 4) Tabela agregada diária (retenção longa, 365 dias)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_presence_daily (
  user_id        bigint NOT NULL,
  client_id      bigint NOT NULL,
  day_brt        date   NOT NULL,
  online_seconds integer NOT NULL DEFAULT 0,
  sessions_count integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day_brt)
);

CREATE INDEX IF NOT EXISTS idx_upd_client_day
  ON public.user_presence_daily (client_id, day_brt DESC);

GRANT SELECT ON public.user_presence_daily TO authenticated;
GRANT ALL    ON public.user_presence_daily TO service_role;

ALTER TABLE public.user_presence_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upd_authenticated_read" ON public.user_presence_daily;
CREATE POLICY "upd_authenticated_read"
  ON public.user_presence_daily
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "upd_service_all" ON public.user_presence_daily;
CREATE POLICY "upd_service_all"
  ON public.user_presence_daily
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- =========================================================
-- 5) Rollup diário: heartbeats -> user_presence_daily
--    Conta slots distintos por usuário no dia BRT e
--    estima sessions_count pelos "gaps" > 2 min entre slots.
-- =========================================================
CREATE OR REPLACE FUNCTION public.rollup_user_presence_daily(
  p_day date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1)
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from timestamptz := (p_day::timestamp AT TIME ZONE 'America/Sao_Paulo');
  v_to   timestamptz := ((p_day + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo');
  v_rows integer;
BEGIN
  WITH src AS (
    SELECT
      user_id,
      client_id,
      seen_at,
      LAG(seen_at) OVER (PARTITION BY user_id ORDER BY seen_at) AS prev_at
    FROM public.user_presence_heartbeats
    WHERE seen_at >= v_from AND seen_at < v_to
  ),
  agg AS (
    SELECT
      user_id,
      client_id,
      count(*) * 30                                                    AS online_seconds,
      1 + count(*) FILTER (WHERE prev_at IS NOT NULL
                             AND seen_at - prev_at > interval '2 minutes') AS sessions_count
    FROM src
    GROUP BY user_id, client_id
  )
  INSERT INTO public.user_presence_daily (user_id, client_id, day_brt, online_seconds, sessions_count, updated_at)
  SELECT user_id, client_id, p_day, online_seconds, sessions_count, now()
    FROM agg
  ON CONFLICT (user_id, day_brt) DO UPDATE
    SET online_seconds = EXCLUDED.online_seconds,
        sessions_count = EXCLUDED.sessions_count,
        client_id      = EXCLUDED.client_id,
        updated_at     = now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rollup_user_presence_daily(date) TO service_role;

-- Limpeza do agregado (365 dias por padrão).
CREATE OR REPLACE FUNCTION public.cleanup_user_presence_daily(
  p_retention_days integer DEFAULT 365
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.user_presence_daily
   WHERE day_brt < ((now() AT TIME ZONE 'America/Sao_Paulo')::date - (p_retention_days || ' days')::interval);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_user_presence_daily(integer) TO service_role;

-- =========================================================
-- 6) Atualiza get_user_online_seconds para usar o agregado quando o
--    período estiver inteiramente fora da janela "hot" (>2 dias atrás).
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_user_online_seconds(
  p_user_id bigint,
  p_from    timestamptz,
  p_to      timestamptz
) RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_from_day date := (p_from AT TIME ZONE 'America/Sao_Paulo')::date;
  v_to_day   date := (p_to   AT TIME ZONE 'America/Sao_Paulo')::date;
  v_hot bigint := 0;
  v_cold bigint := 0;
BEGIN
  -- Janela "fria" (<= ontem): usa agregado diário.
  IF v_from_day < v_today THEN
    SELECT COALESCE(SUM(online_seconds), 0) INTO v_cold
      FROM public.user_presence_daily
     WHERE user_id = p_user_id
       AND day_brt >= v_from_day
       AND day_brt <  LEAST(v_to_day + 1, v_today);
  END IF;

  -- Janela "quente" (hoje): calcula on the fly nos heartbeats brutos.
  IF v_to_day >= v_today THEN
    SELECT COALESCE(count(*) * 30, 0) INTO v_hot
      FROM public.user_presence_heartbeats
     WHERE user_id = p_user_id
       AND seen_at >= GREATEST(p_from, (v_today::timestamp AT TIME ZONE 'America/Sao_Paulo'))
       AND seen_at <  p_to;
  END IF;

  RETURN v_hot + v_cold;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_online_seconds(bigint, timestamptz, timestamptz) TO authenticated;
