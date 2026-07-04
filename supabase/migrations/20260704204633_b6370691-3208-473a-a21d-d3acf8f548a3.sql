DROP INDEX IF EXISTS public.wavoip_call_logs_whatsapp_call_id_key;
DELETE FROM public.wavoip_call_logs a USING public.wavoip_call_logs b WHERE a.ctid < b.ctid AND a.whatsapp_call_id IS NOT DISTINCT FROM b.whatsapp_call_id;
ALTER TABLE public.wavoip_call_logs ADD CONSTRAINT wavoip_call_logs_whatsapp_call_id_key UNIQUE (whatsapp_call_id);