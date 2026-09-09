ALTER TABLE public.dsp_message_templates
  ADD COLUMN IF NOT EXISTS footer text NULL,
  ADD COLUMN IF NOT EXISTS buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS file_name text NULL;

ALTER TABLE public.dsp_campaign_variants
  ADD COLUMN IF NOT EXISTS footer text NULL,
  ADD COLUMN IF NOT EXISTS buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS file_name text NULL,
  ADD COLUMN IF NOT EXISTS template_params jsonb NULL;