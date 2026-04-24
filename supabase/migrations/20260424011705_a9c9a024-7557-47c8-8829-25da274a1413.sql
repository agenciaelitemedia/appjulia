-- Persist payload per item so the resume worker can drain pending items
-- without re-fetching from UaZapi. JSONB array of raw messages.
ALTER TABLE public.uazapi_history_items
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_uazapi_history_items_pending_old
  ON public.uazapi_history_items (created_at)
  WHERE status = 'pending';