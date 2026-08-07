ALTER TABLE public.xj_agents
  ADD COLUMN IF NOT EXISTS activation jsonb NOT NULL DEFAULT '{}'::jsonb;