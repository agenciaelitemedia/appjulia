CREATE TABLE IF NOT EXISTS public.dsp_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  name text NOT NULL,
  description text,
  source text NOT NULL DEFAULT 'manual',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  field_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  total_active integer NOT NULL DEFAULT 0,
  total_removed integer NOT NULL DEFAULT 0,
  last_synced_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsp_audiences TO authenticated;
GRANT ALL ON public.dsp_audiences TO service_role;
ALTER TABLE public.dsp_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dsp_audiences_all" ON public.dsp_audiences FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_dsp_audiences_client ON public.dsp_audiences (client_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dsp_audiences_client_name_active
  ON public.dsp_audiences (client_id, lower(name)) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.dsp_audience_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id uuid NOT NULL REFERENCES public.dsp_audiences(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  phone_e164 text NOT NULL,
  name text,
  first_name text,
  email text,
  document text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_id uuid,
  origin text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'active',
  invalid_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsp_audience_contacts TO authenticated;
GRANT ALL ON public.dsp_audience_contacts TO service_role;
ALTER TABLE public.dsp_audience_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dsp_audience_contacts_all" ON public.dsp_audience_contacts FOR ALL USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dsp_audience_contacts_phone
  ON public.dsp_audience_contacts (audience_id, phone_e164);
CREATE INDEX IF NOT EXISTS idx_dsp_audience_contacts_status
  ON public.dsp_audience_contacts (audience_id, status);
CREATE INDEX IF NOT EXISTS idx_dsp_audience_contacts_client
  ON public.dsp_audience_contacts (client_id, phone_e164);

ALTER TABLE public.dsp_campaigns ADD COLUMN IF NOT EXISTS audience_id uuid;
ALTER TABLE public.dsp_campaigns ADD COLUMN IF NOT EXISTS audience_mode text NOT NULL DEFAULT 'inline';
CREATE INDEX IF NOT EXISTS idx_dsp_campaigns_audience ON public.dsp_campaigns (audience_id);

CREATE OR REPLACE FUNCTION public.dsp_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_dsp_audiences_updated ON public.dsp_audiences;
CREATE TRIGGER trg_dsp_audiences_updated BEFORE UPDATE ON public.dsp_audiences
  FOR EACH ROW EXECUTE FUNCTION public.dsp_touch_updated_at();

DROP TRIGGER IF EXISTS trg_dsp_audience_contacts_updated ON public.dsp_audience_contacts;
CREATE TRIGGER trg_dsp_audience_contacts_updated BEFORE UPDATE ON public.dsp_audience_contacts
  FOR EACH ROW EXECUTE FUNCTION public.dsp_touch_updated_at();