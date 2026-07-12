ALTER TABLE public.wavoip_device_queues REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wavoip_device_queues;