ALTER TABLE public.xj_agents
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'reception',
  ADD COLUMN IF NOT EXISTS case_id uuid REFERENCES public.xj_legal_cases(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS xj_agents_specialist_case_uniq
  ON public.xj_agents (client_id, case_id)
  WHERE role = 'specialist' AND case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS xj_agents_role_idx ON public.xj_agents (client_id, role);