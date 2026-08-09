ALTER TABLE public.xj_sessions
  ADD COLUMN IF NOT EXISTS prompt_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_usd numeric(12,6) NOT NULL DEFAULT 0;

ALTER TABLE public.xj_session_events
  ADD COLUMN IF NOT EXISTS cost_usd numeric(12,6);