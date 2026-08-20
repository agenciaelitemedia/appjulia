ALTER TABLE public.alert_crm_cards REPLICA IDENTITY FULL;
ALTER TABLE public.alert_crm_card_actions REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_crm_cards;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_crm_card_actions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;