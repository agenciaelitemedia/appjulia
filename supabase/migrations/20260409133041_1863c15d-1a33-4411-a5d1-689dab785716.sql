CREATE TABLE public.generation_legal_case_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  version_number int NOT NULL,
  case_name text NOT NULL,
  category text NOT NULL,
  case_info text,
  qualification_script text,
  fees_info text,
  changed_by text,
  change_summary text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.generation_legal_case_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on generation_legal_case_versions"
  ON public.generation_legal_case_versions FOR ALL
  USING (true) WITH CHECK (true);