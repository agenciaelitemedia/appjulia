-- =============================================
-- AUTOMAÇÃO DE DEALS - REGRAS DE MOVIMENTAÇÃO
-- =============================================

-- Tabela de regras de automação
CREATE TABLE public.crm_automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES crm_boards(id) ON DELETE CASCADE,
  cod_agent TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Trigger conditions (quando executar)
  trigger_type TEXT NOT NULL DEFAULT 'field_change', -- 'field_change', 'time_based', 'manual'
  trigger_field TEXT, -- campo que dispara a automação (ex: 'priority', 'value', custom field)
  trigger_operator TEXT, -- 'equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'is_empty', 'is_not_empty'
  trigger_value TEXT, -- valor de comparação
  
  -- Additional conditions (condições adicionais)
  conditions JSONB DEFAULT '[]'::jsonb, -- array de condições extras [{field, operator, value}]
  
  -- Source pipeline filter (de qual pipeline)
  from_pipeline_id UUID REFERENCES crm_pipelines(id) ON DELETE SET NULL,
  
  -- Action (o que fazer)
  action_type TEXT NOT NULL DEFAULT 'move_to_pipeline', -- 'move_to_pipeline', 'update_field', 'set_status'
  to_pipeline_id UUID REFERENCES crm_pipelines(id) ON DELETE SET NULL,
  action_data JSONB DEFAULT '{}'::jsonb, -- dados adicionais da ação
  
  -- Metadata
  position INTEGER NOT NULL DEFAULT 0,
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_automation_rules ENABLE ROW LEVEL SECURITY;

-- Policy for all operations
CREATE POLICY "Allow all operations on crm_automation_rules"
  ON public.crm_automation_rules
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_crm_automation_rules_updated_at
  BEFORE UPDATE ON public.crm_automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_updated_at();

-- Tabela de log de execução das automações
CREATE TABLE public.crm_automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES crm_automation_rules(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT true,
  from_pipeline_id UUID REFERENCES crm_pipelines(id) ON DELETE SET NULL,
  to_pipeline_id UUID REFERENCES crm_pipelines(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.crm_automation_logs ENABLE ROW LEVEL SECURITY;

-- Policy for all operations
CREATE POLICY "Allow all operations on crm_automation_logs"
  ON public.crm_automation_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime for automation rules
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_automation_rules;

-- Index for faster queries
CREATE INDEX idx_crm_automation_rules_board_id ON public.crm_automation_rules(board_id);
CREATE INDEX idx_crm_automation_rules_active ON public.crm_automation_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_crm_automation_logs_rule_id ON public.crm_automation_logs(rule_id);
CREATE INDEX idx_crm_automation_logs_deal_id ON public.crm_automation_logs(deal_id);