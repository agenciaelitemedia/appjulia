ALTER TABLE public.alert_notification_logs ADD COLUMN IF NOT EXISTS client_id text;
CREATE INDEX IF NOT EXISTS idx_alert_notification_logs_client ON public.alert_notification_logs (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_notification_logs_status ON public.alert_notification_logs (status, created_at DESC);