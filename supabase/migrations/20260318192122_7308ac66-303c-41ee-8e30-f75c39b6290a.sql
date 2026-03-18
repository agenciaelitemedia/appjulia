
CREATE TABLE IF NOT EXISTS public.crm_copilot_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_copilot_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on crm_copilot_chat_messages"
  ON public.crm_copilot_chat_messages
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_copilot_chat_user_created ON public.crm_copilot_chat_messages (user_id, created_at);
