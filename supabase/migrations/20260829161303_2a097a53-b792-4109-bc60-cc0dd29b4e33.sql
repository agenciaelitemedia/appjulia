
CREATE TABLE IF NOT EXISTS public.cop_oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL UNIQUE,
  client_secret text,
  client_name text NOT NULL DEFAULT 'Cliente MCP',
  redirect_uris text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cop_oauth_clients TO authenticated;
GRANT ALL ON public.cop_oauth_clients TO service_role;
ALTER TABLE public.cop_oauth_clients ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "cop_clients_read" ON public.cop_oauth_clients FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.cop_oauth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  request_id text NOT NULL UNIQUE,
  client_id text NOT NULL,
  redirect_uri text NOT NULL,
  code_challenge text,
  code_challenge_method text,
  scope text NOT NULL DEFAULT 'leads:read',
  state text,
  resource text,
  julia_user_id text,
  julia_client_id text,
  julia_user_email text,
  approved_at timestamptz,
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cop_oauth_codes TO authenticated;
GRANT ALL ON public.cop_oauth_codes TO service_role;
ALTER TABLE public.cop_oauth_codes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "cop_codes_read" ON public.cop_oauth_codes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.cop_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL UNIQUE,
  refresh_token text UNIQUE,
  client_id text NOT NULL,
  client_name text,
  scope text NOT NULL DEFAULT 'leads:read',
  julia_user_id text NOT NULL,
  julia_client_id text NOT NULL,
  julia_user_email text,
  kind text NOT NULL DEFAULT 'connector',
  last_used_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cop_oauth_tokens TO authenticated;
GRANT ALL ON public.cop_oauth_tokens TO service_role;
ALTER TABLE public.cop_oauth_tokens ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "cop_tokens_read" ON public.cop_oauth_tokens FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS cop_tokens_user_idx ON public.cop_oauth_tokens (julia_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cop_tokens_client_idx ON public.cop_oauth_tokens (julia_client_id);
