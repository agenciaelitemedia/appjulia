ALTER TABLE public.internal_notifications
ADD COLUMN IF NOT EXISTS alert_level text NOT NULL DEFAULT 'info';

ALTER TABLE public.internal_notifications
DROP CONSTRAINT IF EXISTS internal_notifications_alert_level_check;

ALTER TABLE public.internal_notifications
ADD CONSTRAINT internal_notifications_alert_level_check
CHECK (alert_level IN ('info','notice','alert'));