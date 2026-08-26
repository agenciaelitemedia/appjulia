DROP POLICY IF EXISTS "dsp_provider_defaults_app_access" ON public.dsp_provider_defaults;

GRANT SELECT, INSERT, UPDATE ON public.dsp_provider_defaults TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsp_provider_defaults TO authenticated;
GRANT ALL ON public.dsp_provider_defaults TO service_role;

CREATE POLICY "dsp_provider_defaults_read_app"
ON public.dsp_provider_defaults
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "dsp_provider_defaults_insert_app"
ON public.dsp_provider_defaults
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "dsp_provider_defaults_update_app"
ON public.dsp_provider_defaults
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);