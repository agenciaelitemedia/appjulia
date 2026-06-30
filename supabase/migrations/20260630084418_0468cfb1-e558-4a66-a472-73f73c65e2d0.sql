ALTER TABLE public.wavoip_devices ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.wavoip_call_logs ALTER COLUMN user_id DROP NOT NULL;