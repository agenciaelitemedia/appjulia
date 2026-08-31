ALTER TABLE public.cop_oauth_tokens
  ADD COLUMN IF NOT EXISTS previous_access_token text,
  ADD COLUMN IF NOT EXISTS previous_refresh_token text,
  ADD COLUMN IF NOT EXISTS previous_token_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS cop_oauth_tokens_prev_access_idx
  ON public.cop_oauth_tokens (previous_access_token)
  WHERE previous_access_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS cop_oauth_tokens_prev_refresh_idx
  ON public.cop_oauth_tokens (previous_refresh_token)
  WHERE previous_refresh_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cop_auth_failures (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  path text,
  method text,
  token_hint text,
  client_hint text,
  julia_client_id text,
  detail text
);

GRANT SELECT ON public.cop_auth_failures TO authenticated;
GRANT ALL ON public.cop_auth_failures TO service_role;

ALTER TABLE public.cop_auth_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cop_auth_failures_read" ON public.cop_auth_failures;
CREATE POLICY "cop_auth_failures_read" ON public.cop_auth_failures FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS cop_auth_failures_created_idx ON public.cop_auth_failures (created_at DESC);

CREATE OR REPLACE FUNCTION public.cop_auth_failure_stats(p_hours integer DEFAULT 24)
RETURNS TABLE (reason text, total bigint, ultima timestamptz)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT f.reason, count(*)::bigint AS total, max(f.created_at) AS ultima
    FROM public.cop_auth_failures f
   WHERE f.created_at > now() - make_interval(hours => greatest(coalesce(p_hours, 24), 1))
   GROUP BY f.reason
   ORDER BY total DESC
$$;

CREATE OR REPLACE FUNCTION public.cop_auth_failures_cleanup()
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  DELETE FROM public.cop_auth_failures WHERE created_at < now() - interval '30 days'
$$;