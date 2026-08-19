GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_crm_cards TO anon, authenticated;
GRANT ALL ON public.alert_crm_cards TO service_role;

DROP POLICY IF EXISTS "Authenticated can manage alert crm cards" ON public.alert_crm_cards;
CREATE POLICY "Application can manage alert crm cards"
ON public.alert_crm_cards
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_crm_card_actions TO anon, authenticated;
GRANT ALL ON public.alert_crm_card_actions TO service_role;

DROP POLICY IF EXISTS "Authenticated can manage alert crm card actions" ON public.alert_crm_card_actions;
CREATE POLICY "Application can manage alert crm card actions"
ON public.alert_crm_card_actions
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);