-- Tabela de contatos do chat
CREATE TABLE public.chat_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  cod_agent TEXT,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT,
  is_group BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,
  unread_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de mensagens
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.chat_contacts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  message_id TEXT,
  text TEXT,
  type TEXT DEFAULT 'text',
  from_me BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'sent',
  media_url TEXT,
  file_name TEXT,
  caption TEXT,
  reply_to TEXT,
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_chat_contacts_client ON public.chat_contacts(client_id);
CREATE INDEX idx_chat_contacts_phone ON public.chat_contacts(phone);
CREATE INDEX idx_chat_contacts_cod_agent ON public.chat_contacts(cod_agent);
CREATE INDEX idx_chat_contacts_last_message ON public.chat_contacts(last_message_at DESC);
CREATE INDEX idx_chat_messages_contact ON public.chat_messages(contact_id);
CREATE INDEX idx_chat_messages_timestamp ON public.chat_messages(timestamp DESC);
CREATE INDEX idx_chat_messages_message_id ON public.chat_messages(message_id);

-- Índice composto para busca de contatos por cliente
CREATE INDEX idx_chat_contacts_client_agent ON public.chat_contacts(client_id, cod_agent);

-- Enable Row Level Security
ALTER TABLE public.chat_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies para chat_contacts
CREATE POLICY "Users can view their own contacts"
ON public.chat_contacts
FOR SELECT
USING (true);

CREATE POLICY "Users can insert contacts"
ON public.chat_contacts
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update contacts"
ON public.chat_contacts
FOR UPDATE
USING (true);

CREATE POLICY "Users can delete contacts"
ON public.chat_contacts
FOR DELETE
USING (true);

-- RLS Policies para chat_messages
CREATE POLICY "Users can view messages"
ON public.chat_messages
FOR SELECT
USING (true);

CREATE POLICY "Users can insert messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update messages"
ON public.chat_messages
FOR UPDATE
USING (true);

CREATE POLICY "Users can delete messages"
ON public.chat_messages
FOR DELETE
USING (true);

-- Habilitar Realtime para as tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_chat_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_chat_contacts_updated_at
BEFORE UPDATE ON public.chat_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_chat_contacts_updated_at();