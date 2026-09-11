CREATE POLICY "Service role manages contact memory items"
ON public.chat_contact_memory_items
FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages contact memory history"
ON public.chat_contact_memory_history
FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages contact memory state"
ON public.chat_contact_memory_state
FOR ALL TO service_role
USING (true) WITH CHECK (true);