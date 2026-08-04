CREATE TABLE IF NOT EXISTS public.offices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id BIGINT NOT NULL UNIQUE,
  owner_user_id BIGINT,
  office_name TEXT NOT NULL,
  business_name TEXT,
  federal_id TEXT,
  email TEXT,
  phone TEXT,
  owner_name TEXT,
  owner_email TEXT,
  plan_id BIGINT,
  plan_name TEXT,
  leads_limit INTEGER,
  due_day INTEGER,
  expires_at DATE,
  modules TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offices TO anon;
GRANT ALL ON public.offices TO service_role;

ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offices_app_access" ON public.offices FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_offices_client_id ON public.offices (client_id);
CREATE INDEX IF NOT EXISTS idx_offices_is_active ON public.offices (is_active);

CREATE TRIGGER trg_offices_updated_at
BEFORE UPDATE ON public.offices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();