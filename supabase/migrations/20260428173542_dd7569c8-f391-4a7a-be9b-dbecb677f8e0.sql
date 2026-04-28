CREATE OR REPLACE VIEW public.active_queues AS
SELECT id, client_id, name, channel_type
FROM public.queues
WHERE is_deleted = false;

GRANT SELECT ON public.active_queues TO anon, authenticated, service_role;