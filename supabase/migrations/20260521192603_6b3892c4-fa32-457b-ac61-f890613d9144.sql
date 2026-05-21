DROP POLICY IF EXISTS "Authenticated can read ai model list" ON public.client_ai_model_config_list;
DROP POLICY IF EXISTS "Authenticated can insert ai model list" ON public.client_ai_model_config_list;
DROP POLICY IF EXISTS "Authenticated can update ai model list" ON public.client_ai_model_config_list;
DROP POLICY IF EXISTS "Authenticated can delete ai model list" ON public.client_ai_model_config_list;

CREATE POLICY "Public read ai model list" ON public.client_ai_model_config_list FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert ai model list" ON public.client_ai_model_config_list FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update ai model list" ON public.client_ai_model_config_list FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete ai model list" ON public.client_ai_model_config_list FOR DELETE TO anon, authenticated USING (true);