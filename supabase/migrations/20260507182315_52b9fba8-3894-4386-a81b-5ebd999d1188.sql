
-- Remove agendamento anterior se existir
DO $$
BEGIN
  PERFORM cron.unschedule('chat-return-chat-every-minute');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'chat-return-chat-every-minute',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1/chat-return-chat',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inplbml6Z3lyd2xvbm11ZnhuanF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzcwNzgsImV4cCI6MjA4NDUxMzA3OH0.Vyy30LJ_03Y_sDYSL3YEDBRSTtui336oOm2e3ireRlc","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inplbml6Z3lyd2xvbm11ZnhuanF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzcwNzgsImV4cCI6MjA4NDUxMzA3OH0.Vyy30LJ_03Y_sDYSL3YEDBRSTtui336oOm2e3ireRlc"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  );
  $cron$
);
