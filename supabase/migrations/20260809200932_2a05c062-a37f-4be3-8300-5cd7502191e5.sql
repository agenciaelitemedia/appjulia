ALTER TABLE public.xj_sessions
  ADD COLUMN IF NOT EXISTS audio_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audio_mode_reason text;