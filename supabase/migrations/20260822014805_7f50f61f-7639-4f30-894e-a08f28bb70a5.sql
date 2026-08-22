GRANT SELECT ON public.xj_usage_limits TO anon;
GRANT SELECT ON public.xj_usage_counters TO anon;

DROP POLICY IF EXISTS "xj_usage_limits_read" ON public.xj_usage_limits;
CREATE POLICY "xj_usage_limits_read" ON public.xj_usage_limits FOR SELECT USING (true);

DROP POLICY IF EXISTS "xj_usage_counters_read" ON public.xj_usage_counters;
CREATE POLICY "xj_usage_counters_read" ON public.xj_usage_counters FOR SELECT USING (true);