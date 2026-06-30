ALTER TABLE public.wavoip_devices
  ADD COLUMN IF NOT EXISTS app_user_id bigint;

CREATE INDEX IF NOT EXISTS wavoip_devices_app_user_idx
  ON public.wavoip_devices(app_user_id);

ALTER TABLE public.wavoip_call_logs
  ADD COLUMN IF NOT EXISTS app_user_id bigint;

CREATE INDEX IF NOT EXISTS wavoip_call_logs_app_user_idx
  ON public.wavoip_call_logs(app_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.release_wavoip_devices_from_plan(p_user_plan_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.wavoip_devices
     SET status = 'free',
         client_id = NULL,
         user_plan_id = NULL,
         user_id = NULL,
         app_user_id = NULL,
         connection_status = 'disconnected',
         connected_at = NULL,
         whatsapp_jids = '[]'::jsonb,
         updated_at = now()
   WHERE user_plan_id = p_user_plan_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;