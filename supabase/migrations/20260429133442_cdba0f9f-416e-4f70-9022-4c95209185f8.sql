ALTER TABLE public.telephony_orders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.telephony_orders;