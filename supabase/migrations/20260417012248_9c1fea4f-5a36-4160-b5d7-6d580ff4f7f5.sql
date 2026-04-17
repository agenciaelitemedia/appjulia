
-- API Keys for public API access
CREATE TABLE public.chat_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  cod_agent text,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['conversations:read','conversations:write','messages:write']::text[],
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
CREATE INDEX idx_chat_api_keys_hash ON public.chat_api_keys(key_hash);
CREATE INDEX idx_chat_api_keys_client ON public.chat_api_keys(client_id);
ALTER TABLE public.chat_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on chat_api_keys" ON public.chat_api_keys FOR ALL USING (true) WITH CHECK (true);

-- Knowledge Base
CREATE TABLE public.chat_kb_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  icon text DEFAULT 'book',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_kb_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on chat_kb_categories" ON public.chat_kb_categories FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.chat_kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  cod_agent text,
  category_id uuid REFERENCES public.chat_kb_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text,
  content text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  keywords text[] NOT NULL DEFAULT '{}'::text[],
  is_published boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  use_count integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_kb_articles_client ON public.chat_kb_articles(client_id);
CREATE INDEX idx_chat_kb_articles_title_trgm ON public.chat_kb_articles USING gin (title gin_trgm_ops);
CREATE INDEX idx_chat_kb_articles_content_trgm ON public.chat_kb_articles USING gin (content gin_trgm_ops);
ALTER TABLE public.chat_kb_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on chat_kb_articles" ON public.chat_kb_articles FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_chat_kb_articles_updated_at
  BEFORE UPDATE ON public.chat_kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_contacts_updated_at();

-- CSAT auto-send configuration
CREATE TABLE public.chat_csat_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  cod_agent text,
  is_active boolean NOT NULL DEFAULT false,
  auto_send_after_resolve boolean NOT NULL DEFAULT true,
  delay_minutes integer NOT NULL DEFAULT 5,
  survey_type text NOT NULL DEFAULT 'csat',
  message_template text NOT NULL DEFAULT 'Olá! Como você avalia o atendimento que recebeu hoje? Responda com uma nota de 1 a 5.',
  thank_you_message text NOT NULL DEFAULT 'Obrigado pelo seu feedback! 🙏',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_csat_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on chat_csat_config" ON public.chat_csat_config FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_chat_csat_config_updated_at
  BEFORE UPDATE ON public.chat_csat_config
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_contacts_updated_at();
