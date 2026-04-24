ALTER TABLE public.uazapi_history_runs
  ADD COLUMN IF NOT EXISTS duplicate_messages integer NOT NULL DEFAULT 0;