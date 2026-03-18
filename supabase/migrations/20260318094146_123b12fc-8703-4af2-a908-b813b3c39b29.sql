CREATE TABLE IF NOT EXISTS public.crm_copilot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL,
  enabled_insight_types jsonb NOT NULL DEFAULT '["stuck_lead","hot_opportunity","risk","follow_up_needed","summary"]'::jsonb,
  custom_prompt_suffix text,
  max_insights_per_run integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_copilot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on crm_copilot_settings" ON public.crm_copilot_settings FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_copilot_settings;