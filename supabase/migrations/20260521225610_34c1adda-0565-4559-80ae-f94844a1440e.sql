ALTER TABLE public.chat_conversation_history REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversation_history';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;