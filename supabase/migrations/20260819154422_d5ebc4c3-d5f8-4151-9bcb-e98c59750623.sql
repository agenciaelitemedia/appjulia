ALTER TABLE public.alert_notification_configs
  ADD COLUMN IF NOT EXISTS no_response_minutes integer NOT NULL DEFAULT 30;