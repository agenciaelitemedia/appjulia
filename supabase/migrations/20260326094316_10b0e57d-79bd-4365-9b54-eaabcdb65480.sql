CREATE TABLE public.generation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  prompt_text text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.generation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on generation_templates"
  ON public.generation_templates
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);