CREATE TABLE public.migration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_url text NOT NULL,
  target_project_id text,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  error_message text,
  tables_total integer DEFAULT 0,
  tables_done integer DEFAULT 0,
  rows_copied bigint DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.migration_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.migration_runs(id) ON DELETE CASCADE,
  step_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  progress integer DEFAULT 0,
  message text,
  detail jsonb,
  error_message text,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.migration_runs TO service_role;
GRANT ALL ON public.migration_steps TO service_role;

ALTER TABLE public.migration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role only" ON public.migration_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role only" ON public.migration_steps FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_migration_runs_updated_at
BEFORE UPDATE ON public.migration_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_timestamp();

CREATE TRIGGER trg_migration_steps_updated_at
BEFORE UPDATE ON public.migration_steps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_timestamp();
