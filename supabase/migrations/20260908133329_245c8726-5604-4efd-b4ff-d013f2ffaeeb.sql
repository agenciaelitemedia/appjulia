DELETE FROM public.wavoip_reconcile_queue a
USING public.wavoip_reconcile_queue b
WHERE a.whatsapp_call_id = b.whatsapp_call_id AND a.created_at < b.created_at;
CREATE UNIQUE INDEX IF NOT EXISTS wavoip_reconcile_queue_call_uidx ON public.wavoip_reconcile_queue (whatsapp_call_id);