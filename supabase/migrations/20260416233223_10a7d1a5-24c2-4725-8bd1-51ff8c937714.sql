-- ============================================
-- Sprint 2 — Produtividade & UX (base)
-- ============================================

-- 1) Agendamento de mensagens
CREATE TABLE IF NOT EXISTS public.chat_scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  cod_agent TEXT,
  contact_id UUID NOT NULL,
  conversation_id UUID,
  scheduled_for TIMESTAMPTZ NOT NULL,
  text TEXT,
  media_url TEXT,
  media_type TEXT,
  caption TEXT,
  file_name TEXT,
  reply_to TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed | cancelled
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_message_id UUID,
  created_by TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_scheduled_due
  ON public.chat_scheduled_messages (status, scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_chat_scheduled_contact
  ON public.chat_scheduled_messages (contact_id, status);

ALTER TABLE public.chat_scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on chat_scheduled_messages"
  ON public.chat_scheduled_messages FOR ALL
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_chat_scheduled_updated_at
  BEFORE UPDATE ON public.chat_scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_contacts_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_scheduled_messages;
ALTER TABLE public.chat_scheduled_messages REPLICA IDENTITY FULL;

-- 2) Snooze (adiar conversa) — adiciona colunas em chat_conversations
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snooze_reason TEXT,
  ADD COLUMN IF NOT EXISTS snoozed_by TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_conv_snoozed
  ON public.chat_conversations (snoozed_until)
  WHERE snoozed_until IS NOT NULL;

-- 3) Busca full-text em mensagens (índice GIN trigram para LIKE rápido)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_chat_messages_text_trgm
  ON public.chat_messages USING GIN (text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_chat_messages_caption_trgm
  ON public.chat_messages USING GIN (caption gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_chat_messages_contact_ts
  ON public.chat_messages (contact_id, timestamp DESC);

-- 4) Tabela de presença efêmera (atendentes vendo a conversa)
-- Usaremos Realtime Presence (in-memory), mas mantemos uma tabela leve
-- para histórico/auditoria opcional. Apenas heartbeat curto (~30s).
CREATE TABLE IF NOT EXISTS public.chat_conversation_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  user_identifier TEXT NOT NULL,
  user_name TEXT,
  user_avatar TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_identifier)
);

CREATE INDEX IF NOT EXISTS idx_chat_presence_conv
  ON public.chat_conversation_presence (conversation_id, last_seen_at DESC);

ALTER TABLE public.chat_conversation_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on chat_conversation_presence"
  ON public.chat_conversation_presence FOR ALL
  USING (true) WITH CHECK (true);
