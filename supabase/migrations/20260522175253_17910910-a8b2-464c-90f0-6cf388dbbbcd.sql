
ALTER TABLE public.internal_notification_recipients REPLICA IDENTITY FULL;
ALTER TABLE public.internal_notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='internal_notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_notifications';
  END IF;
END $$;
