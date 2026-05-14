CREATE TABLE IF NOT EXISTS public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  points INT NOT NULL DEFAULT 10,
  category TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  estimated_hours INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_templates_all" ON public.task_templates;
CREATE POLICY "task_templates_all" ON public.task_templates FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  template_id UUID REFERENCES public.task_templates(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  points INT NOT NULL DEFAULT 10,
  category TEXT,
  assigned_to TEXT,
  assigned_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_all" ON public.tasks;
CREATE POLICY "tasks_all" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.task_points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  points INT NOT NULL,
  action TEXT NOT NULL DEFAULT 'earned' CHECK (action IN ('earned','deducted')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_points_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_points_ledger_all" ON public.task_points_ledger;
CREATE POLICY "task_points_ledger_all" ON public.task_points_ledger FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_task_templates_client ON public.task_templates(client_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tasks_client_assigned ON public.tasks(client_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_client_status ON public.tasks(client_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_deal ON public.tasks(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_client_user ON public.task_points_ledger(client_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON public.task_points_ledger(client_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.fn_task_complete_points()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    NEW.completed_at := now();
    INSERT INTO public.task_points_ledger(client_id, user_id, user_name, task_id, points, action)
    VALUES (NEW.client_id, COALESCE(NEW.assigned_to,''), NEW.assigned_name, NEW.id, NEW.points, 'earned');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_complete ON public.tasks;
CREATE TRIGGER trg_task_complete
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.fn_task_complete_points();

CREATE OR REPLACE FUNCTION public.get_task_ranking(
  p_client_id TEXT,
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(user_id TEXT, user_name TEXT, total_points BIGINT)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT l.user_id, l.user_name, SUM(l.points) AS total_points
  FROM public.task_points_ledger l
  WHERE l.client_id = p_client_id
    AND l.action = 'earned'
    AND (p_since IS NULL OR l.created_at >= p_since)
  GROUP BY l.user_id, l.user_name
  ORDER BY total_points DESC;
$$;