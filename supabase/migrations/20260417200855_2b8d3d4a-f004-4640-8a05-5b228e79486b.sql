ALTER TABLE public.generation_agent_prompts
  ADD COLUMN IF NOT EXISTS prompt_published_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS prompt_published_by text NULL;