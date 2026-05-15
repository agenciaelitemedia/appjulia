
-- ============= 1. task_categories =============
CREATE TABLE public.task_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id text NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_task_categories_client_name_active
  ON public.task_categories (client_id, lower(name)) WHERE is_active;
CREATE INDEX idx_task_categories_client ON public.task_categories(client_id) WHERE is_active;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_categories_all ON public.task_categories FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_task_categories_updated BEFORE UPDATE ON public.task_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_crm_updated_at();

-- ============= 2. category_id em tasks/templates =============
ALTER TABLE public.task_templates
  ADD COLUMN category_id uuid REFERENCES public.task_categories(id) ON DELETE SET NULL;
ALTER TABLE public.tasks
  ADD COLUMN category_id uuid REFERENCES public.task_categories(id) ON DELETE SET NULL;
CREATE INDEX idx_task_templates_category ON public.task_templates(category_id);
CREATE INDEX idx_tasks_category ON public.tasks(category_id);

-- Backfill: criar categorias a partir dos valores distintos atuais
WITH distinct_cats AS (
  SELECT DISTINCT client_id, NULLIF(TRIM(category), '') AS name
  FROM (
    SELECT client_id, category FROM public.task_templates WHERE category IS NOT NULL
    UNION
    SELECT client_id, category FROM public.tasks WHERE category IS NOT NULL
  ) s
  WHERE NULLIF(TRIM(category), '') IS NOT NULL
), inserted AS (
  INSERT INTO public.task_categories (client_id, name, color, is_active)
  SELECT client_id, name, '#6366f1', true FROM distinct_cats
  ON CONFLICT DO NOTHING
  RETURNING id, client_id, name
)
SELECT 1;

UPDATE public.task_templates t SET category_id = c.id
FROM public.task_categories c
WHERE c.client_id = t.client_id AND lower(c.name) = lower(t.category) AND t.category_id IS NULL;

UPDATE public.tasks t SET category_id = c.id
FROM public.task_categories c
WHERE c.client_id = t.client_id AND lower(c.name) = lower(t.category) AND t.category_id IS NULL;

-- ============= 3. task_template_items =============
CREATE TABLE public.task_template_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  title text NOT NULL,
  description text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_template_items_tpl ON public.task_template_items(template_id, position);
ALTER TABLE public.task_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_template_items_all ON public.task_template_items FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_task_template_items_updated BEFORE UPDATE ON public.task_template_items
  FOR EACH ROW EXECUTE FUNCTION public.update_crm_updated_at();

-- ============= 4. task_items =============
CREATE TABLE public.task_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  template_item_id uuid REFERENCES public.task_template_items(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  position int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
  completed_at timestamptz,
  completed_by text,
  cancelled_at timestamptz,
  cancelled_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_items_task ON public.task_items(task_id, position);
CREATE INDEX idx_task_items_client_status ON public.task_items(client_id, status);
ALTER TABLE public.task_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_items_all ON public.task_items FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_task_items_updated BEFORE UPDATE ON public.task_items
  FOR EACH ROW EXECUTE FUNCTION public.update_crm_updated_at();

-- ============= 5. Trigger: validar conclusão manual de tarefa =============
CREATE OR REPLACE FUNCTION public.fn_validate_task_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_pending int;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'pending')
      INTO v_total, v_pending
    FROM public.task_items WHERE task_id = NEW.id;

    IF v_total > 0 AND v_pending > 0 THEN
      RAISE EXCEPTION 'Não é possível concluir a tarefa: existem itens pendentes.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Ordem: validar ANTES de fn_task_complete_points (que já é BEFORE UPDATE)
CREATE TRIGGER trg_task_validate_completion
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_task_completion();

-- ============= 6. Trigger: auto-conclusão/cancelamento por itens =============
CREATE OR REPLACE FUNCTION public.fn_task_auto_resolve_from_items()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_task_id uuid;
  v_task_status text;
  v_total int;
  v_pending int;
  v_completed int;
  v_cancelled int;
BEGIN
  v_task_id := COALESCE(NEW.task_id, OLD.task_id);
  IF v_task_id IS NULL THEN RETURN NULL; END IF;

  SELECT status INTO v_task_status FROM public.tasks WHERE id = v_task_id;
  IF v_task_status IS DISTINCT FROM 'in_progress' THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status = 'pending'),
         COUNT(*) FILTER (WHERE status = 'completed'),
         COUNT(*) FILTER (WHERE status = 'cancelled')
    INTO v_total, v_pending, v_completed, v_cancelled
  FROM public.task_items WHERE task_id = v_task_id;

  IF v_total = 0 OR v_pending > 0 THEN
    RETURN NULL;
  END IF;

  IF v_completed > 0 THEN
    -- Pelo menos um item concluído e nada pendente => tarefa concluída
    UPDATE public.tasks SET status = 'completed', updated_at = now() WHERE id = v_task_id;
  ELSIF v_cancelled = v_total THEN
    -- Todos cancelados => tarefa cancelada
    UPDATE public.tasks SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE id = v_task_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_task_items_auto_resolve
  AFTER INSERT OR UPDATE OR DELETE ON public.task_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_task_auto_resolve_from_items();

-- ============= 7. Realtime =============
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_template_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_items;
