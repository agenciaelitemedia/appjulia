CREATE TABLE public.quick_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message_text TEXT NOT NULL,
  shortcut TEXT,
  category TEXT DEFAULT 'geral',
  use_locations TEXT[] DEFAULT '{chat_popup}',
  is_active BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.quick_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on quick_messages" ON public.quick_messages FOR ALL USING (true) WITH CHECK (true);