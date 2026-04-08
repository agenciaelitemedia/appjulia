
CREATE TABLE support_assistant_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text,
  api_url text,
  api_key text,
  instance_token text,
  connection_status text DEFAULT 'disconnected',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE support_assistant_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on support_assistant_config" ON support_assistant_config FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE support_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text,
  group_jid text NOT NULL,
  group_name text,
  sender_jid text,
  sender_name text,
  message_id text,
  message_type text DEFAULT 'text',
  message_text text,
  media_url text,
  is_from_me boolean DEFAULT false,
  raw_payload jsonb,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE support_group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on support_group_messages" ON support_group_messages FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_support_group_messages_group ON support_group_messages(group_jid);
CREATE INDEX idx_support_group_messages_ts ON support_group_messages(timestamp);
