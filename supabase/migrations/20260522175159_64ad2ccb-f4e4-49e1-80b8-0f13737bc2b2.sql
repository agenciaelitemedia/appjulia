
-- Internal notifications system
CREATE TABLE IF NOT EXISTS public.internal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'message',
  poll_options jsonb,
  audience text NOT NULL DEFAULT 'all',
  scope text NOT NULL DEFAULT 'office',
  created_by text NOT NULL,
  created_by_name text,
  created_by_client_id text,
  status text NOT NULL DEFAULT 'draft',
  scheduled_for timestamptz,
  sent_at timestamptz,
  recipients_total integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.internal_notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.internal_notifications(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_name text,
  user_role text,
  client_id text,
  read_at timestamptz,
  responded_at timestamptz,
  poll_choice text,
  response_text text,
  dismissed boolean NOT NULL DEFAULT false,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_inotif_recipients_user ON public.internal_notification_recipients(user_id, read_at, dismissed);
CREATE INDEX IF NOT EXISTS idx_inotif_recipients_notif ON public.internal_notification_recipients(notification_id);
CREATE INDEX IF NOT EXISTS idx_inotif_status ON public.internal_notifications(status, scheduled_for);

ALTER TABLE public.internal_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_notification_recipients ENABLE ROW LEVEL SECURITY;

-- App auth is external (no Supabase auth.uid). Permissive policies aligned with
-- the rest of this project; access is mediated by the application + service role.
CREATE POLICY "inotif_all_access" ON public.internal_notifications
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "inotif_recipients_all_access" ON public.internal_notification_recipients
  FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_notification_recipients;
