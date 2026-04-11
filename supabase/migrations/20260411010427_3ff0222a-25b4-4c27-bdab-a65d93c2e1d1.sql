
-- =============================================
-- 1. chat_conversations (tickets)
-- =============================================
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.chat_contacts(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  cod_agent TEXT,
  channel TEXT NOT NULL DEFAULT 'whatsapp_uazapi',
  status TEXT NOT NULL DEFAULT 'pending',
  protocol TEXT NOT NULL,
  assigned_to TEXT,
  department TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  tags TEXT[] DEFAULT '{}',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_response_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  close_reason TEXT,
  close_note TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Protocol sequence for auto-generation
CREATE SEQUENCE IF NOT EXISTS chat_conversation_protocol_seq START WITH 1;

-- Index for fast lookups
CREATE INDEX idx_chat_conversations_contact_id ON public.chat_conversations(contact_id);
CREATE INDEX idx_chat_conversations_client_id ON public.chat_conversations(client_id);
CREATE INDEX idx_chat_conversations_status ON public.chat_conversations(status);
CREATE INDEX idx_chat_conversations_protocol ON public.chat_conversations(protocol);
CREATE INDEX idx_chat_conversations_cod_agent ON public.chat_conversations(cod_agent);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on chat_conversations" ON public.chat_conversations
  FOR ALL USING (true) WITH CHECK (true);

-- Auto-generate protocol on insert
CREATE OR REPLACE FUNCTION public.generate_conversation_protocol()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.protocol IS NULL OR NEW.protocol = '' THEN
    NEW.protocol := '#' || to_char(now(), 'YYYY') || '-' || lpad(nextval('chat_conversation_protocol_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_conversation_protocol
  BEFORE INSERT ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_conversation_protocol();

-- Updated_at trigger
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chat_contacts_updated_at();

-- =============================================
-- 2. chat_conversation_history (event log)
-- =============================================
CREATE TABLE public.chat_conversation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_name TEXT,
  from_value TEXT,
  to_value TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_conv_history_conversation ON public.chat_conversation_history(conversation_id);

ALTER TABLE public.chat_conversation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on chat_conversation_history" ON public.chat_conversation_history
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 3. chat_tags
-- =============================================
CREATE TABLE public.chat_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  client_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_tags_client ON public.chat_tags(client_id);

ALTER TABLE public.chat_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on chat_tags" ON public.chat_tags
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 4. chat_conversation_tags (junction)
-- =============================================
CREATE TABLE public.chat_conversation_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.chat_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, tag_id)
);

ALTER TABLE public.chat_conversation_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on chat_conversation_tags" ON public.chat_conversation_tags
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 5. chat_departments
-- =============================================
CREATE TABLE public.chat_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  agents TEXT[] DEFAULT '{}',
  client_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on chat_departments" ON public.chat_departments
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 6. Alter chat_messages — add new columns
-- =============================================
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS internal_note BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sender_name TEXT;

CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id);

-- Enable realtime for chat_conversations
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
