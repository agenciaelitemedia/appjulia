ALTER TABLE public.wavoip_call_logs
  ADD COLUMN IF NOT EXISTS transcription_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS transcription_text text NULL,
  ADD COLUMN IF NOT EXISTS transcription_summary text NULL,
  ADD COLUMN IF NOT EXISTS transcription_error text NULL,
  ADD COLUMN IF NOT EXISTS transcription_generated_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS wavoip_call_logs_transcription_status_idx
  ON public.wavoip_call_logs (transcription_status);