ALTER TABLE public.dsp_channel_limits
  ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_weight integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notes text;