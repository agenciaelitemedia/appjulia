ALTER TABLE public.dsp_campaigns
  ADD COLUMN IF NOT EXISTS crm_push_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS crm_board_id uuid,
  ADD COLUMN IF NOT EXISTS crm_pipeline_id uuid,
  ADD COLUMN IF NOT EXISTS crm_assigned_to text;