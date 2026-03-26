CREATE TABLE public.generation_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.generation_templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  name text NOT NULL,
  description text,
  prompt_text text NOT NULL,
  changed_by text,
  change_summary text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.generation_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on generation_template_versions"
ON public.generation_template_versions
FOR ALL
TO public
USING (true)
WITH CHECK (true);