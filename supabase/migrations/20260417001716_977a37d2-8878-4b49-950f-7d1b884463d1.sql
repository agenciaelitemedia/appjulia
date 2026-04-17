-- Chat automation rules
CREATE TABLE public.chat_automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL,
  cod_agent TEXT,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('new_conversation','keyword','inactivity','outside_hours','tag_added')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_type TEXT NOT NULL CHECK (action_type IN ('auto_assign','auto_tag','send_message','auto_close','set_priority','transfer_queue')),
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on chat_automation_rules" ON public.chat_automation_rules FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_car_client_active ON public.chat_automation_rules(client_id, is_active);
CREATE INDEX idx_car_trigger ON public.chat_automation_rules(trigger_type, is_active);

-- Logs
CREATE TABLE public.chat_automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL,
  conversation_id UUID,
  client_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  action_type TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  details JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_automation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on chat_automation_logs" ON public.chat_automation_logs FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_cal_rule_executed ON public.chat_automation_logs(rule_id, executed_at DESC);
CREATE INDEX idx_cal_conversation ON public.chat_automation_logs(conversation_id);

-- Updated trigger
CREATE TRIGGER update_chat_automation_rules_updated_at
  BEFORE UPDATE ON public.chat_automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_contacts_updated_at();