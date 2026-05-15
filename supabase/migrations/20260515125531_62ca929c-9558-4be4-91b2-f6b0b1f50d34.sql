
-- 1. Function: touch presence (server-side timestamp prevents clock skew)
CREATE OR REPLACE FUNCTION public.touch_user_presence(p_user_id bigint, p_client_id bigint)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF p_user_id IS NULL OR p_client_id IS NULL THEN
    RETURN v_now;
  END IF;
  INSERT INTO public.user_presence (user_id, client_id, last_seen_at, updated_at)
  VALUES (p_user_id, p_client_id, v_now, v_now)
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = EXCLUDED.last_seen_at,
        client_id    = EXCLUDED.client_id,
        updated_at   = EXCLUDED.updated_at;
  RETURN v_now;
END;
$$;

-- 2. Function: clear presence (used on logout / pagehide)
CREATE OR REPLACE FUNCTION public.clear_user_presence(p_user_id bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.user_presence WHERE user_id = p_user_id;
$$;

-- 3. View: server-computed status (online ≤ 60s, away ≤ 5min, else offline)
CREATE OR REPLACE VIEW public.user_presence_status AS
SELECT
  user_id,
  client_id,
  last_seen_at,
  (now() - last_seen_at) < interval '60 seconds' AS is_online,
  (now() - last_seen_at) >= interval '60 seconds'
    AND (now() - last_seen_at) < interval '5 minutes' AS is_away,
  EXTRACT(EPOCH FROM (now() - last_seen_at))::int AS seconds_since_seen
FROM public.user_presence;

GRANT EXECUTE ON FUNCTION public.touch_user_presence(bigint, bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_user_presence(bigint) TO anon, authenticated;
GRANT SELECT ON public.user_presence_status TO anon, authenticated;
