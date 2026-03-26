
-- Table: generation_agent_prompts
CREATE TABLE public.generation_agent_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_agent text NOT NULL,
  agent_name text,
  business_name text,
  template_id uuid REFERENCES public.generation_templates(id),
  ai_name text DEFAULT 'Julia',
  practice_areas text,
  working_hours text,
  office_info text,
  welcome_message text,
  is_active boolean DEFAULT true,
  created_by text,
  updated_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.generation_agent_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on generation_agent_prompts" ON public.generation_agent_prompts FOR ALL USING (true) WITH CHECK (true);

-- Table: generation_agent_prompt_cases
CREATE TABLE public.generation_agent_prompt_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_prompt_id uuid NOT NULL REFERENCES public.generation_agent_prompts(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.generation_legal_cases(id),
  case_name text,
  ctas jsonb DEFAULT '[]'::jsonb,
  semantic_words text,
  case_info text,
  qualification_script text,
  zapsign_token text,
  zapsign_doc_token text,
  contract_fields jsonb,
  fees_text text,
  closing_model_text text,
  negotiation_text text,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.generation_agent_prompt_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on generation_agent_prompt_cases" ON public.generation_agent_prompt_cases FOR ALL USING (true) WITH CHECK (true);

-- Table: generation_agent_prompt_versions
CREATE TABLE public.generation_agent_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.generation_agent_prompts(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  snapshot jsonb,
  changed_by text,
  change_summary text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.generation_agent_prompt_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on generation_agent_prompt_versions" ON public.generation_agent_prompt_versions FOR ALL USING (true) WITH CHECK (true);
