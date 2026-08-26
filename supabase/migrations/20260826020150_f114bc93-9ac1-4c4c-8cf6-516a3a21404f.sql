-- Campanhas: agendamento com fuso e aprovação
ALTER TABLE public.dsp_campaigns
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS schedule_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS schedule_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_window_control BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approval_notes TEXT;

ALTER TABLE public.dsp_campaigns
  DROP CONSTRAINT IF EXISTS dsp_campaigns_approval_status_check;
ALTER TABLE public.dsp_campaigns
  ADD CONSTRAINT dsp_campaigns_approval_status_check
  CHECK (approval_status IN ('draft','pending','approved','rejected'));

CREATE INDEX IF NOT EXISTS idx_dsp_campaigns_schedule
  ON public.dsp_campaigns (status, schedule_start_at, schedule_end_at);

-- Templates de mensagem com aprovação
CREATE TABLE IF NOT EXISTS public.dsp_message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'marketing',
  body TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  variables TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  submitted_by TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  review_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dsp_message_templates_status_check
    CHECK (status IN ('draft','pending','approved','rejected'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsp_message_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsp_message_templates TO anon;
GRANT ALL ON public.dsp_message_templates TO service_role;

ALTER TABLE public.dsp_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dsp_message_templates_all" ON public.dsp_message_templates
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_dsp_templates_client
  ON public.dsp_message_templates (client_id, status, created_at DESC);

CREATE TRIGGER trg_dsp_message_templates_updated_at
  BEFORE UPDATE ON public.dsp_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Variantes podem referenciar um template aprovado
ALTER TABLE public.dsp_campaign_variants
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.dsp_message_templates(id) ON DELETE SET NULL;