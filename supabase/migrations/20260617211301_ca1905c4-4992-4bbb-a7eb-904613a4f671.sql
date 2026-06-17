GRANT SELECT ON public.user_presence_heartbeats TO authenticated;
CREATE POLICY uph_authenticated_read ON public.user_presence_heartbeats FOR SELECT TO authenticated USING (true);