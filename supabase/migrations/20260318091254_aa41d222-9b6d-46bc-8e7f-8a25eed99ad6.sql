
-- Create crm_copilot_config table
CREATE TABLE public.crm_copilot_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL,
  cod_agent text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  check_interval_business integer NOT NULL DEFAULT 15,
  check_interval_off integer NOT NULL DEFAULT 120,
  business_hours_start text NOT NULL DEFAULT '08:00',
  business_hours_end text NOT NULL DEFAULT '20:00',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  last_check_at timestamptz,
  last_data_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cod_agent)
);

-- Create crm_copilot_insights table
CREATE TABLE public.crm_copilot_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL,
  cod_agent text NOT NULL,
  insight_type text NOT NULL DEFAULT 'summary',
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  description text NOT NULL,
  related_cards jsonb DEFAULT '[]'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_copilot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_copilot_insights ENABLE ROW LEVEL SECURITY;

-- RLS policies (public access like other tables in this project)
CREATE POLICY "Allow all operations on crm_copilot_config" ON public.crm_copilot_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on crm_copilot_insights" ON public.crm_copilot_insights FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for insights
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_copilot_insights;

-- Update trigger for crm_copilot_config
CREATE TRIGGER update_crm_copilot_config_updated_at
  BEFORE UPDATE ON public.crm_copilot_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_updated_at();
