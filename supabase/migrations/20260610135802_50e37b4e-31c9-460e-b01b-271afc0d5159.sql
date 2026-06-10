DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_client_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_client_settings;
  END IF;
END $$;

ALTER TABLE public.chat_client_settings REPLICA IDENTITY FULL;