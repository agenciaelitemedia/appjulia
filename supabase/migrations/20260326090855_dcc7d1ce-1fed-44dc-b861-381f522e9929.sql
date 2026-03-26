
-- Table: generation_legal_cases
CREATE TABLE public.generation_legal_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_name text NOT NULL,
  category text NOT NULL,
  case_info text,
  qualification_script text,
  fees_info text,
  created_by text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.generation_legal_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on generation_legal_cases"
  ON public.generation_legal_cases
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Table: generation_prompt_config
CREATE TABLE public.generation_prompt_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  prompt_text text NOT NULL,
  description text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.generation_prompt_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on generation_prompt_config"
  ON public.generation_prompt_config
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
