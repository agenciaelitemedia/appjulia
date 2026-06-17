
-- =========================================================
-- user_presence_heartbeats: registra slots de 30s onde o usuário esteve online
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_presence_heartbeats (
  user_id    bigint      NOT NULL,
  client_id  bigint      NOT NULL,
  seen_at    timestamptz NOT NULL,
  PRIMARY KEY (user_id, seen_at)
);

CREATE INDEX IF NOT EXISTS idx_uph_client_seen
  ON public.user_presence_heartbeats (client_id, seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_uph_seen_at
  ON public.user_presence_heartbeats (seen_at);

GRANT SELECT, INSERT ON public.user_presence_heartbeats TO authenticated;
GRANT ALL            ON public.user_presence_heartbeats TO service_role;

ALTER TABLE public.user_presence_heartbeats ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy aberta: inserção/leitura passam pelas funções SECURITY DEFINER.
DROP POLICY IF EXISTS "uph_service_all" ON public.user_presence_heartbeats;
CREATE POLICY "uph_service_all"
  ON public.user_presence_heartbeats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =========================================================
-- RPC: grava em lote vários slots (até N por chamada)
-- Os slots são truncados/arredondados a múltiplos de 30s no cliente.
-- =========================================================
CREATE OR REPLACE FUNCTION public.touch_user_presence_batch(
  p_user_id   bigint,
  p_client_id bigint,
  p_slots     timestamptz[]
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_inserted int := 0;
  v_slot timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_client_id IS NULL OR p_slots IS NULL THEN
    RETURN 0;
  END IF;

  -- Atualiza presença "leve" para compatibilidade com o dashboard atual.
  INSERT INTO public.user_presence (user_id, client_id, last_seen_at, updated_at)
  VALUES (p_user_id, p_client_id, v_now, v_now)
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = EXCLUDED.last_seen_at,
        client_id    = EXCLUDED.client_id,
        updated_at   = EXCLUDED.updated_at;

  -- Insere cada slot, ignorando duplicatas (idempotente).
  FOREACH v_slot IN ARRAY p_slots LOOP
    -- Sanitiza: arredonda para múltiplo de 30s e descarta valores absurdos.
    IF v_slot IS NULL THEN CONTINUE; END IF;
    IF v_slot > v_now + interval '5 minutes' THEN CONTINUE; END IF;
    IF v_slot < v_now - interval '30 minutes' THEN CONTINUE; END IF;

    v_slot := to_timestamp(floor(extract(epoch FROM v_slot) / 30) * 30);

    INSERT INTO public.user_presence_heartbeats (user_id, client_id, seen_at)
    VALUES (p_user_id, p_client_id, v_slot)
    ON CONFLICT DO NOTHING;

    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_user_presence_batch(bigint, bigint, timestamptz[]) TO authenticated;

-- =========================================================
-- Limpeza de heartbeats > 90 dias
-- =========================================================
CREATE OR REPLACE FUNCTION public.cleanup_user_presence_heartbeats()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM public.user_presence_heartbeats
   WHERE seen_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_user_presence_heartbeats() TO service_role;

-- =========================================================
-- RPC: tempo online efetivo no período (em segundos)
-- Cada slot distinto representa 30s de presença real.
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_user_online_seconds(
  p_user_id bigint,
  p_from    timestamptz,
  p_to      timestamptz
) RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(count(*) * 30, 0)::bigint
    FROM public.user_presence_heartbeats
   WHERE user_id = p_user_id
     AND seen_at >= p_from
     AND seen_at <  p_to;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_online_seconds(bigint, timestamptz, timestamptz) TO authenticated;
