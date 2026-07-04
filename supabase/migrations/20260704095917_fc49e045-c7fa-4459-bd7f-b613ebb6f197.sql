
CREATE TABLE public.wavoip_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('wavoip_multicanal','wavoip_free')),
  api_base text NOT NULL DEFAULT 'https://api.wavoip.com',
  username text NOT NULL,
  password text NOT NULL,
  token text,
  token_updated_at timestamptz,
  last_login_status text,
  last_login_error text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wavoip_providers TO authenticated;
GRANT ALL ON public.wavoip_providers TO service_role;

ALTER TABLE public.wavoip_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wavoip_providers_all" ON public.wavoip_providers FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.wavoip_providers_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER wavoip_providers_updated_at
  BEFORE UPDATE ON public.wavoip_providers
  FOR EACH ROW EXECUTE FUNCTION public.wavoip_providers_touch_updated_at();
