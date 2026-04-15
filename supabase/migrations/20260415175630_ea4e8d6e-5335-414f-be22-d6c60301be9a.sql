
-- Push subscriptions table
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on push_subscriptions" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- Push notifications table (admin module)
CREATE TABLE public.push_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  icon text,
  url text,
  target_type text NOT NULL DEFAULT 'all',
  target_value text,
  sent_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  status text DEFAULT 'draft',
  created_by integer,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on push_notifications" ON public.push_notifications FOR ALL USING (true) WITH CHECK (true);
