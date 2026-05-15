DROP VIEW IF EXISTS public.user_presence_status;

CREATE VIEW public.user_presence_status WITH (security_invoker = on) AS
SELECT
  user_id,
  client_id,
  last_seen_at,
  (now() - last_seen_at) <= '00:05:00'::interval AS is_online,
  (now() - last_seen_at) > '00:05:00'::interval
    AND (now() - last_seen_at) <= '00:30:00'::interval AS is_away,
  EXTRACT(epoch FROM now() - last_seen_at)::integer AS seconds_since_seen
FROM public.user_presence;