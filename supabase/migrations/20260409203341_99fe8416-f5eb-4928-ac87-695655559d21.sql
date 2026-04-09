
CREATE TABLE public.support_monitored_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_jid text NOT NULL UNIQUE,
  group_name text NOT NULL DEFAULT '',
  picture_url text,
  is_active boolean NOT NULL DEFAULT true,
  auto_added boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.support_monitored_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on support_monitored_groups"
  ON public.support_monitored_groups
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.support_group_messages
  ADD COLUMN IF NOT EXISTS sender_role text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS transcription text,
  ADD COLUMN IF NOT EXISTS is_transcribed boolean DEFAULT false;
