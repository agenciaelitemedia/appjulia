
CREATE OR REPLACE FUNCTION public.blitzleads_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.blitzleads_route_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain text NOT NULL DEFAULT 'blitzleads.atendejulia.com.br',
  mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blitzleads_route_config TO authenticated;
GRANT ALL ON public.blitzleads_route_config TO service_role;
ALTER TABLE public.blitzleads_route_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage blitzleads_route_config" ON public.blitzleads_route_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_blitzleads_route_config_updated_at BEFORE UPDATE ON public.blitzleads_route_config
  FOR EACH ROW EXECUTE FUNCTION public.blitzleads_touch_updated_at();

CREATE TABLE public.blitzleads_cases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_name text NOT NULL,
  phone text,
  product text,
  subject text,
  status text NOT NULL DEFAULT 'parou',
  priority int NOT NULL DEFAULT 0,
  sla_deadline timestamptz,
  score int NOT NULL DEFAULT 0,
  next_action text,
  assigned_to uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blitzleads_cases TO authenticated;
GRANT ALL ON public.blitzleads_cases TO service_role;
ALTER TABLE public.blitzleads_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage blitzleads_cases" ON public.blitzleads_cases
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_blitzleads_cases_status ON public.blitzleads_cases(status);
CREATE INDEX idx_blitzleads_cases_sla ON public.blitzleads_cases(sla_deadline);
CREATE TRIGGER trg_blitzleads_cases_updated_at BEFORE UPDATE ON public.blitzleads_cases
  FOR EACH ROW EXECUTE FUNCTION public.blitzleads_touch_updated_at();

CREATE TABLE public.blitzleads_case_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.blitzleads_cases(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blitzleads_case_events TO authenticated;
GRANT ALL ON public.blitzleads_case_events TO service_role;
ALTER TABLE public.blitzleads_case_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage blitzleads_case_events" ON public.blitzleads_case_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_blitzleads_case_events_case ON public.blitzleads_case_events(case_id);

CREATE TABLE public.blitzleads_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blitzleads_settings TO authenticated;
GRANT ALL ON public.blitzleads_settings TO service_role;
ALTER TABLE public.blitzleads_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage blitzleads_settings" ON public.blitzleads_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_blitzleads_settings_updated_at BEFORE UPDATE ON public.blitzleads_settings
  FOR EACH ROW EXECUTE FUNCTION public.blitzleads_touch_updated_at();

INSERT INTO public.blitzleads_route_config (domain, mappings)
VALUES (
  'blitzleads.atendejulia.com.br',
  '{"/": "/BlitzLead/", "/blitz_auth": "/BlitzLead/blitz_auth", "/call-center": "/BlitzLead/call-center"}'::jsonb
);
