ALTER TABLE public.phone_user_plans
  ADD COLUMN IF NOT EXISTS recording_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transcription_enabled boolean NOT NULL DEFAULT false;