SELECT cron.unschedule('chat-inbound-queue-cleanup-daily');

SELECT cron.schedule(
  'chat-inbound-queue-cleanup-hourly',
  '15 * * * *',
  $$
  DELETE FROM public.chat_inbound_queue
  WHERE status = 'done'
    AND coalesce(processed_at, created_at) < now() - interval '12 hours';
  $$
);