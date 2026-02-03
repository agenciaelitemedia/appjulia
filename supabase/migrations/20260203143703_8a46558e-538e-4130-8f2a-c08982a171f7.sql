-- =============================================
-- CRM BUILDER - CAMPOS CUSTOMIZÁVEIS
-- =============================================

-- Tipos de campos disponíveis: text, number, date, select, multiselect, checkbox, url, email, phone

CREATE TABLE public.crm_custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.crm_boards(id) ON DELETE CASCADE,
  cod_agent TEXT NOT NULL,
  field_name TEXT NOT NULL, -- nome interno (snake_case)
  field_label TEXT NOT NULL, -- label visível ao usuário
  field_type TEXT NOT NULL DEFAULT 'text',
  options JSONB DEFAULT '[]'::jsonb, -- para select/multiselect: [{value: 'x', label: 'X'}]
  default_value TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Garantir nome único por board
  CONSTRAINT unique_field_name_per_board UNIQUE (board_id, field_name)
);

-- Índices para performance
CREATE INDEX idx_crm_custom_fields_board ON public.crm_custom_fields(board_id);
CREATE INDEX idx_crm_custom_fields_cod_agent ON public.crm_custom_fields(cod_agent);

-- Enable RLS
ALTER TABLE public.crm_custom_fields ENABLE ROW LEVEL SECURITY;

-- Policy para acesso baseado em cod_agent
CREATE POLICY "Allow all operations on crm_custom_fields"
  ON public.crm_custom_fields
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_crm_custom_fields_updated_at
  BEFORE UPDATE ON public.crm_custom_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_updated_at();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_custom_fields;