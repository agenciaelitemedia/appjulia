CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id bigint PRIMARY KEY,
  client_id bigint NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_presence_client_lastseen
  ON public.user_presence (client_id, last_seen_at DESC);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_presence_all ON public.user_presence
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.user_presence REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;