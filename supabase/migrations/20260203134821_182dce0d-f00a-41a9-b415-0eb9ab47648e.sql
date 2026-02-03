-- =============================================
-- CRM CUSTOMIZÁVEL - TABELAS PRINCIPAIS
-- =============================================

-- 1. BOARDS - Quadros/Painéis do CRM
CREATE TABLE public.crm_boards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cod_agent TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'layout-dashboard',
  color TEXT DEFAULT '#3b82f6',
  position INTEGER NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

-- 2. PIPELINES - Etapas dentro de cada board
CREATE TABLE public.crm_pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.crm_boards(id) ON DELETE CASCADE,
  cod_agent TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6b7280',
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  win_probability INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. DEALS - Cards/Negócios dentro dos pipelines
CREATE TABLE public.crm_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES public.crm_boards(id) ON DELETE CASCADE,
  cod_agent TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  value NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'archived')),
  position INTEGER NOT NULL DEFAULT 0,
  expected_close_date DATE,
  custom_fields JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  assigned_to TEXT,
  stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

-- 4. DEAL HISTORY - Histórico de movimentações
CREATE TABLE public.crm_deal_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'moved', 'updated', 'note_added', 'won', 'lost')),
  from_pipeline_id UUID REFERENCES public.crm_pipelines(id) ON DELETE SET NULL,
  to_pipeline_id UUID REFERENCES public.crm_pipelines(id) ON DELETE SET NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changes JSONB DEFAULT '{}',
  notes TEXT
);

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================
CREATE INDEX idx_crm_boards_cod_agent ON public.crm_boards(cod_agent);
CREATE INDEX idx_crm_boards_position ON public.crm_boards(cod_agent, position);
CREATE INDEX idx_crm_pipelines_board ON public.crm_pipelines(board_id);
CREATE INDEX idx_crm_pipelines_cod_agent ON public.crm_pipelines(cod_agent);
CREATE INDEX idx_crm_deals_pipeline ON public.crm_deals(pipeline_id);
CREATE INDEX idx_crm_deals_board ON public.crm_deals(board_id);
CREATE INDEX idx_crm_deals_cod_agent ON public.crm_deals(cod_agent);
CREATE INDEX idx_crm_deals_status ON public.crm_deals(status);
CREATE INDEX idx_crm_deal_history_deal ON public.crm_deal_history(deal_id);

-- =============================================
-- TRIGGER PARA UPDATED_AT
-- =============================================
CREATE OR REPLACE FUNCTION public.update_crm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_crm_boards_updated_at
  BEFORE UPDATE ON public.crm_boards
  FOR EACH ROW EXECUTE FUNCTION public.update_crm_updated_at();

CREATE TRIGGER update_crm_pipelines_updated_at
  BEFORE UPDATE ON public.crm_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_crm_updated_at();

CREATE TRIGGER update_crm_deals_updated_at
  BEFORE UPDATE ON public.crm_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_crm_updated_at();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.crm_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deal_history ENABLE ROW LEVEL SECURITY;

-- Policies para crm_boards (acesso público por cod_agent já que não usamos auth)
CREATE POLICY "Allow all operations on crm_boards" ON public.crm_boards FOR ALL USING (true) WITH CHECK (true);

-- Policies para crm_pipelines
CREATE POLICY "Allow all operations on crm_pipelines" ON public.crm_pipelines FOR ALL USING (true) WITH CHECK (true);

-- Policies para crm_deals
CREATE POLICY "Allow all operations on crm_deals" ON public.crm_deals FOR ALL USING (true) WITH CHECK (true);

-- Policies para crm_deal_history
CREATE POLICY "Allow all operations on crm_deal_history" ON public.crm_deal_history FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- HABILITAR REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_boards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_pipelines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_deals;