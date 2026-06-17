
CREATE OR REPLACE FUNCTION public.ensure_user_presence_partitions_range(
  p_from date,
  p_to   date
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cur   date;
  v_end   date;
  v_name  text;
  v_created integer := 0;
BEGIN
  v_cur := date_trunc('month', p_from)::date;
  WHILE v_cur <= date_trunc('month', p_to)::date LOOP
    v_end  := (v_cur + interval '1 month')::date;
    v_name := format('user_presence_heartbeats_%s', to_char(v_cur, 'YYYYMM'));

    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = v_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.user_presence_heartbeats
           FOR VALUES FROM (%L) TO (%L)',
        v_name, v_cur::timestamptz, v_end::timestamptz
      );
      EXECUTE format(
        'CREATE INDEX %I ON public.%I USING brin (seen_at) WITH (pages_per_range = 32)',
        v_name || '_seen_brin', v_name
      );
      EXECUTE format(
        'CREATE INDEX %I ON public.%I (client_id, seen_at DESC)',
        v_name || '_client_seen', v_name
      );
      v_created := v_created + 1;
    END IF;

    v_cur := v_end;
  END LOOP;

  RETURN v_created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_presence_partitions_range(date, date) TO service_role;

-- Atualiza a função de backfill para garantir partições no intervalo antes de inserir.
CREATE OR REPLACE FUNCTION public.backfill_user_presence_heartbeats(
  p_from         timestamptz,
  p_to           timestamptz,
  p_cap_seconds  integer DEFAULT 28800
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pairs           bigint := 0;
  v_slots_inserted  bigint := 0;
  v_users           bigint := 0;
  v_inserted_now    bigint := 0;
  v_pair            record;
  v_start_aligned   timestamptz;
  v_end_capped      timestamptz;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN
    RETURN jsonb_build_object('error', 'invalid range');
  END IF;

  PERFORM public.ensure_user_presence_partitions_range(p_from::date, p_to::date);

  FOR v_pair IN
    WITH evts AS (
      SELECT user_id, client_id, event_type,
             COALESCE(occurred_at, created_at) AS at
      FROM public.user_activity_log
      WHERE user_id IS NOT NULL AND client_id IS NOT NULL
        AND COALESCE(occurred_at, created_at) >= p_from
        AND COALESCE(occurred_at, created_at) <= p_to
        AND event_type IN ('login', 'logout_manual', 'logout_inactivity')
    ),
    enriched AS (
      SELECT user_id, client_id, event_type, at,
             LEAD(at)         OVER (PARTITION BY user_id ORDER BY at) AS next_at,
             LEAD(event_type) OVER (PARTITION BY user_id ORDER BY at) AS next_type
      FROM evts
    )
    SELECT user_id, client_id, at AS login_at, next_at AS logout_at
    FROM enriched
    WHERE event_type = 'login'
      AND next_type IN ('logout_manual', 'logout_inactivity')
      AND next_at IS NOT NULL AND next_at > at
  LOOP
    v_pairs := v_pairs + 1;

    v_start_aligned := to_timestamp(floor(extract(epoch FROM v_pair.login_at) / 30) * 30);
    v_end_capped    := LEAST(v_pair.logout_at,
                             v_pair.login_at + (p_cap_seconds || ' seconds')::interval);
    v_end_capped := to_timestamp(floor(extract(epoch FROM v_end_capped) / 30) * 30);

    IF v_end_capped <= v_start_aligned THEN CONTINUE; END IF;

    WITH ins AS (
      INSERT INTO public.user_presence_heartbeats (user_id, client_id, seen_at)
      SELECT v_pair.user_id, v_pair.client_id, s
        FROM generate_series(v_start_aligned, v_end_capped - interval '30 seconds', interval '30 seconds') s
      ON CONFLICT DO NOTHING
      RETURNING 1
    )
    SELECT count(*) INTO v_inserted_now FROM ins;

    v_slots_inserted := v_slots_inserted + v_inserted_now;
  END LOOP;

  SELECT count(DISTINCT user_id) INTO v_users
    FROM public.user_presence_heartbeats
   WHERE seen_at >= p_from AND seen_at <= p_to;

  RETURN jsonb_build_object(
    'pairs', v_pairs, 'slots_inserted', v_slots_inserted,
    'users', v_users, 'cap_seconds', p_cap_seconds,
    'from', p_from, 'to', p_to
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_user_presence_heartbeats(timestamptz, timestamptz, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.backfill_user_presence_heartbeats(timestamptz, timestamptz, integer) TO service_role;
