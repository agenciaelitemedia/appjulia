-- ============================================
-- Sprint 1: Foundations for Professional Omnichannel
-- Tables: participants, reactions, mentions, CSAT
-- ============================================

-- 1) Conversation participants (observers/watchers)
CREATE TABLE IF NOT EXISTS public.chat_conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  user_identifier TEXT NOT NULL, -- user id or cod_agent of the participant
  user_name TEXT,
  role TEXT NOT NULL DEFAULT 'observer', -- observer | collaborator
  added_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_identifier)
);

ALTER TABLE public.chat_conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on chat_conversation_participants"
  ON public.chat_conversation_participants
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_chat_participants_conversation
  ON public.chat_conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user
  ON public.chat_conversation_participants(user_identifier);

-- 2) Message reactions
CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL, -- references chat_messages.id
  external_message_id TEXT, -- whatsapp message id for sync
  reactor TEXT NOT NULL, -- 'me' or remote_jid
  emoji TEXT NOT NULL,
  from_me BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, reactor)
);

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on chat_message_reactions"
  ON public.chat_message_reactions
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_chat_reactions_message
  ON public.chat_message_reactions(message_id);

-- 3) Mentions inside internal notes
CREATE TABLE IF NOT EXISTS public.chat_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  message_id UUID, -- the internal note message
  mentioned_user TEXT NOT NULL, -- user id of mentioned agent
  mentioned_user_name TEXT,
  mentioned_by TEXT,
  mentioned_by_name TEXT,
  preview_text TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

ALTER TABLE public.chat_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on chat_mentions"
  ON public.chat_mentions
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_chat_mentions_user
  ON public.chat_mentions(mentioned_user, is_read);
CREATE INDEX IF NOT EXISTS idx_chat_mentions_conversation
  ON public.chat_mentions(conversation_id);

-- 4) CSAT / NPS responses
CREATE TABLE IF NOT EXISTS public.chat_csat_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  contact_id UUID,
  client_id TEXT NOT NULL,
  cod_agent TEXT,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  feedback TEXT,
  survey_type TEXT NOT NULL DEFAULT 'csat', -- csat | nps
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'sent' -- sent | responded | expired
);

ALTER TABLE public.chat_csat_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on chat_csat_responses"
  ON public.chat_csat_responses
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_chat_csat_conversation
  ON public.chat_csat_responses(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_csat_client
  ON public.chat_csat_responses(client_id, responded_at);

-- 5) Enable realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mentions;