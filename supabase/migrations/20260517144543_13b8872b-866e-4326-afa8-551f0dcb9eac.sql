
DROP POLICY IF EXISTS "queue_plans manageable by authenticated" ON public.queue_plans;
DROP POLICY IF EXISTS "queue_plans readable by authenticated" ON public.queue_plans;
DROP POLICY IF EXISTS "queue_user_plans manageable by authenticated" ON public.queue_user_plans;
DROP POLICY IF EXISTS "queue_user_plans readable by authenticated" ON public.queue_user_plans;

CREATE POLICY "Allow all on queue_plans" ON public.queue_plans FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on queue_user_plans" ON public.queue_user_plans FOR ALL TO public USING (true) WITH CHECK (true);
