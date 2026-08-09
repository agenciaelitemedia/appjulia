CREATE UNIQUE INDEX IF NOT EXISTS idx_xj_pipelines_client_stage
  ON public.xj_pipelines (client_id, stage_key)
  WHERE stage_key IS NOT NULL;