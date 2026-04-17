
-- Chatbot Builder visual
CREATE TABLE public.chat_bot_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  cod_agent TEXT,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  trigger_keywords TEXT[] NOT NULL DEFAULT '{}',
  trigger_type TEXT NOT NULL DEFAULT 'keyword',
  match_mode TEXT NOT NULL DEFAULT 'contains',
  only_business_hours BOOLEAN NOT NULL DEFAULT false,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_node_id TEXT,
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_bot_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_bot_flows open" ON public.chat_bot_flows FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_chat_bot_flows_client ON public.chat_bot_flows(client_id, is_active);

CREATE TABLE public.chat_bot_flow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.chat_bot_flows(id) ON DELETE CASCADE,
  conversation_id UUID,
  contact_id UUID,
  client_id TEXT NOT NULL,
  current_node_id TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  last_step_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_bot_flow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_bot_flow_runs open" ON public.chat_bot_flow_runs FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_flow_runs_conv ON public.chat_bot_flow_runs(conversation_id, status);

-- Roteamento inteligente
CREATE TABLE public.chat_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  cod_agent TEXT,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  -- conditions: array of { field, op, value }
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- strategy: round_robin | least_busy | manual_pool | specific_agent
  strategy TEXT NOT NULL DEFAULT 'round_robin',
  agent_pool TEXT[] NOT NULL DEFAULT '{}',
  target_queue_id UUID,
  fallback_assigned_to TEXT,
  only_business_hours BOOLEAN NOT NULL DEFAULT false,
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  last_assigned_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_routing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_routing_rules open" ON public.chat_routing_rules FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_routing_client_pos ON public.chat_routing_rules(client_id, position) WHERE is_active = true;

CREATE TABLE public.chat_agent_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  agent_identifier TEXT NOT NULL,
  agent_name TEXT,
  max_concurrent INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'online',
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_load INTEGER NOT NULL DEFAULT 0,
  last_assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, agent_identifier)
);
ALTER TABLE public.chat_agent_capacity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_agent_capacity open" ON public.chat_agent_capacity FOR ALL USING (true) WITH CHECK (true);

-- Inbox unificada — visualizações salvas
CREATE TABLE public.chat_saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  cod_agent TEXT,
  owner_identifier TEXT,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'inbox',
  color TEXT DEFAULT '#6366f1',
  is_shared BOOLEAN NOT NULL DEFAULT false,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_saved_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_saved_views open" ON public.chat_saved_views FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_saved_views_client ON public.chat_saved_views(client_id, owner_identifier);

-- Trigger comum updated_at
CREATE TRIGGER trg_bot_flows_updated BEFORE UPDATE ON public.chat_bot_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_contacts_updated_at();
CREATE TRIGGER trg_routing_updated BEFORE UPDATE ON public.chat_routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_contacts_updated_at();
CREATE TRIGGER trg_capacity_updated BEFORE UPDATE ON public.chat_agent_capacity
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_contacts_updated_at();
CREATE TRIGGER trg_saved_views_updated BEFORE UPDATE ON public.chat_saved_views
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_contacts_updated_at();
