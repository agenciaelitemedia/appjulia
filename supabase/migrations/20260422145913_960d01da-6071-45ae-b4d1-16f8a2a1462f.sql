DROP POLICY IF EXISTS "Authenticated can insert sync jobs" ON public.whatsapp_sync_jobs;
DROP POLICY IF EXISTS "Authenticated can update sync jobs" ON public.whatsapp_sync_jobs;
DROP POLICY IF EXISTS "Authenticated can delete sync jobs" ON public.whatsapp_sync_jobs;
DROP POLICY IF EXISTS "Authenticated can view sync jobs" ON public.whatsapp_sync_jobs;

CREATE POLICY "Public can view sync jobs" ON public.whatsapp_sync_jobs FOR SELECT USING (true);
CREATE POLICY "Public can insert sync jobs" ON public.whatsapp_sync_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update sync jobs" ON public.whatsapp_sync_jobs FOR UPDATE USING (true);
CREATE POLICY "Public can delete sync jobs" ON public.whatsapp_sync_jobs FOR DELETE USING (true);

DROP POLICY IF EXISTS "Authenticated can insert sync job logs" ON public.whatsapp_sync_job_logs;
DROP POLICY IF EXISTS "Authenticated can update sync job logs" ON public.whatsapp_sync_job_logs;
DROP POLICY IF EXISTS "Authenticated can delete sync job logs" ON public.whatsapp_sync_job_logs;
DROP POLICY IF EXISTS "Authenticated can view sync job logs" ON public.whatsapp_sync_job_logs;

CREATE POLICY "Public can view sync job logs" ON public.whatsapp_sync_job_logs FOR SELECT USING (true);
CREATE POLICY "Public can insert sync job logs" ON public.whatsapp_sync_job_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update sync job logs" ON public.whatsapp_sync_job_logs FOR UPDATE USING (true);
CREATE POLICY "Public can delete sync job logs" ON public.whatsapp_sync_job_logs FOR DELETE USING (true);