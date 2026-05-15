
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_name TEXT,
  client_id BIGINT,
  event_type TEXT NOT NULL CHECK (event_type IN ('login','logout_manual','logout_inactivity')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_occurred
  ON public.user_activity_log (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_log_client
  ON public.user_activity_log (client_id, occurred_at DESC);

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_activity_log_all ON public.user_activity_log;
CREATE POLICY user_activity_log_all
  ON public.user_activity_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- View: last login + last logout per user
CREATE OR REPLACE VIEW public.user_last_activity AS
SELECT
  user_id,
  MAX(occurred_at) FILTER (WHERE event_type = 'login') AS last_login_at,
  MAX(occurred_at) FILTER (WHERE event_type IN ('logout_manual','logout_inactivity')) AS last_logout_at,
  (
    SELECT event_type FROM public.user_activity_log l2
    WHERE l2.user_id = l.user_id
      AND l2.event_type IN ('logout_manual','logout_inactivity')
    ORDER BY l2.occurred_at DESC LIMIT 1
  ) AS last_logout_type
FROM public.user_activity_log l
GROUP BY user_id;

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_activity_log;
