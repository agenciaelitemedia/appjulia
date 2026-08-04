CREATE INDEX IF NOT EXISTS idx_chat_bot_flow_runs_waiting
  ON public.chat_bot_flow_runs (status, last_step_at)
  WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS idx_chat_bot_flow_runs_flow_conv_started
  ON public.chat_bot_flow_runs (flow_id, conversation_id, started_at DESC);