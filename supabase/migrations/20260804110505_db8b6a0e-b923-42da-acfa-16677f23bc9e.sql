ALTER TABLE public.chat_bot_flows
  ADD COLUMN IF NOT EXISTS variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE public.chat_bot_flow_runs
  ADD COLUMN IF NOT EXISTS node_logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS trigger_event text,
  ADD COLUMN IF NOT EXISTS is_simulation boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_chat_bot_flow_runs_flow_started
  ON public.chat_bot_flow_runs (flow_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_bot_flows_active_trigger
  ON public.chat_bot_flows (client_id, is_active, trigger_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_bot_flows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_bot_flow_runs TO authenticated;
GRANT ALL ON public.chat_bot_flows TO service_role;
GRANT ALL ON public.chat_bot_flow_runs TO service_role;