ALTER TABLE public.internal_notifications
  DROP CONSTRAINT IF EXISTS internal_notifications_audience_check;
ALTER TABLE public.internal_notifications
  ADD CONSTRAINT internal_notifications_audience_check
  CHECK (audience IN ('all','owners','teams','my_team'));