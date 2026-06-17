
CREATE OR REPLACE FUNCTION public.backfill_user_presence_heartbeats(
  p_from         timestamptz,
  p_to           timestamptz,
  p_cap_seconds  integer DEFAULT 28800   -- 8h
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

  -- Garante partições para todo o intervalo (mês a mês).
  PERFORM public.ensure_user_presence_partitions(0);

  -- Monta os pares login -> próximo logout do mesmo usuário usando window functions.
  -- Apenas logins que possuem um logout cronologicamente posterior são pareados.
  FOR v_pair IN
    WITH evts AS (
      SELECT
        user_id,
        client_id,
        event_type,
        COALESCE(occurred_at, created_at) AS at
      FROM public.user_activity_log
      WHERE user_id IS NOT NULL
        AND client_id IS NOT NULL
        AND COALESCE(occurred_at, created_at) >= p_from
        AND COALESCE(occurred_at, created_at) <= p_to
        AND event_type IN ('login', 'logout_manual', 'logout_inactivity')
    ),
    enriched AS (
      SELECT
        user_id,
        client_id,
        event_type,
        at,
        LEAD(at)         OVER (PARTITION BY user_id ORDER BY at) AS next_at,
        LEAD(event_type) OVER (PARTITION BY user_id ORDER BY at) AS next_type
      FROM evts
    )
    SELECT
      user_id,
      client_id,
      at      AS login_at,
      next_at AS logout_at
    FROM enriched
    WHERE event_type = 'login'
      AND next_type IN ('logout_manual', 'logout_inactivity')
      AND next_at IS NOT NULL
      AND next_at > at
  LOOP
    v_pairs := v_pairs + 1;

    -- Alinha início ao slot de 30s e aplica o cap por sessão.
    v_start_aligned := to_timestamp(floor(extract(epoch FROM v_pair.login_at) / 30) * 30);
    v_end_capped    := LEAST(
                         v_pair.logout_at,
                         v_pair.login_at + (p_cap_seconds || ' seconds')::interval
                       );
    v_end_capped := to_timestamp(floor(extract(epoch FROM v_end_capped) / 30) * 30);

    IF v_end_capped <= v_start_aligned THEN
      CONTINUE;
    END IF;

    -- Insere todos os slots da janela; ON CONFLICT evita colisão com heartbeats reais.
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
    'pairs',           v_pairs,
    'slots_inserted',  v_slots_inserted,
    'users',           v_users,
    'cap_seconds',     p_cap_seconds,
    'from',            p_from,
    'to',              p_to
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_user_presence_heartbeats(timestamptz, timestamptz, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.backfill_user_presence_heartbeats(timestamptz, timestamptz, integer) TO service_role;
