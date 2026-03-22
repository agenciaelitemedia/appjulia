
-- Phone Extension Plans
CREATE TABLE public.phone_extension_plans (
  id serial PRIMARY KEY,
  name text NOT NULL,
  max_extensions integer NOT NULL DEFAULT 5,
  price numeric NOT NULL DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.phone_extension_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on phone_extension_plans" ON public.phone_extension_plans FOR ALL USING (true) WITH CHECK (true);

-- Phone User Plans
CREATE TABLE public.phone_user_plans (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  plan_id integer NOT NULL REFERENCES public.phone_extension_plans(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.phone_user_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on phone_user_plans" ON public.phone_user_plans FOR ALL USING (true) WITH CHECK (true);

-- Phone Extensions
CREATE TABLE public.phone_extensions (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  extension_number text NOT NULL,
  assigned_member_id integer,
  label text,
  api4com_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.phone_extensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on phone_extensions" ON public.phone_extensions FOR ALL USING (true) WITH CHECK (true);

-- Phone Config
CREATE TABLE public.phone_config (
  id serial PRIMARY KEY,
  cod_agent text NOT NULL,
  api4com_domain text NOT NULL,
  api4com_token text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.phone_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on phone_config" ON public.phone_config FOR ALL USING (true) WITH CHECK (true);

-- Phone Call Logs
CREATE TABLE public.phone_call_logs (
  id serial PRIMARY KEY,
  call_id text,
  cod_agent text,
  extension_number text,
  direction text,
  caller text,
  called text,
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  hangup_cause text,
  record_url text,
  cost numeric DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.phone_call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on phone_call_logs" ON public.phone_call_logs FOR ALL USING (true) WITH CHECK (true);
