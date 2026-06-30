
ALTER TABLE public.wavoip_devices
  ADD COLUMN IF NOT EXISTS webhook_status text,
  ADD COLUMN IF NOT EXISTS webhook_url text,
  ADD COLUMN IF NOT EXISTS webhook_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_last_error text;

-- Schedule periodic verification (every 15 min) via pg_cron + pg_net
DO $$
DECLARE
  v_url text := 'https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1/wavoip-verify-webhook';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('wavoip-verify-webhook-every-15-min')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='wavoip-verify-webhook-every-15-min');
    PERFORM cron.schedule(
      'wavoip-verify-webhook-every-15-min',
      '*/15 * * * *',
      format($f$ select net.http_post(url:=%L, headers:='{"Content-Type":"application/json"}'::jsonb, body:='{"auto_fix":true}'::jsonb); $f$, v_url)
    );
  END IF;
END$$;
