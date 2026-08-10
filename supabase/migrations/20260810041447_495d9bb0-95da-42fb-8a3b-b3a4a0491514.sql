CREATE TABLE IF NOT EXISTS public.xj_zapsign_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  case_id uuid NOT NULL,
  agent_id uuid,
  template_token text NOT NULL,
  template_name text NOT NULL,
  folder_path text NOT NULL DEFAULT '',
  docx_file_url text,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_zapsign_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_zapsign_templates TO anon;
GRANT ALL ON public.xj_zapsign_templates TO service_role;

ALTER TABLE public.xj_zapsign_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xj_zapsign_templates_all" ON public.xj_zapsign_templates
  FOR ALL USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_xj_zapsign_templates_case_active
  ON public.xj_zapsign_templates (case_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_xj_zapsign_templates_client
  ON public.xj_zapsign_templates (client_id);

CREATE OR REPLACE FUNCTION public.xj_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_xj_zapsign_templates_updated_at
  BEFORE UPDATE ON public.xj_zapsign_templates
  FOR EACH ROW EXECUTE FUNCTION public.xj_set_updated_at();