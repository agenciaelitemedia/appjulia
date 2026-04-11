
-- WebChat configuration table
CREATE TABLE public.webchat_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cod_agent text NOT NULL,
  client_id text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  widget_title text NOT NULL DEFAULT 'Chat conosco',
  welcome_message text DEFAULT 'Olá! Como podemos ajudar?',
  primary_color text NOT NULL DEFAULT '#3b82f6',
  logo_url text,
  position text NOT NULL DEFAULT 'bottom-right',
  allowed_domains text[] DEFAULT '{}'::text[],
  auto_open_delay_seconds integer DEFAULT 0,
  offline_message text DEFAULT 'Estamos offline no momento. Deixe sua mensagem!',
  collect_email boolean DEFAULT true,
  collect_name boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.webchat_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on webchat_config" ON public.webchat_config FOR ALL USING (true) WITH CHECK (true);

-- WebChat visitor sessions
CREATE TABLE public.webchat_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cod_agent text NOT NULL,
  client_id text NOT NULL,
  visitor_id text NOT NULL,
  visitor_name text,
  visitor_email text,
  contact_id uuid,
  conversation_id uuid,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  last_seen_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.webchat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on webchat_sessions" ON public.webchat_sessions FOR ALL USING (true) WITH CHECK (true);

-- Instagram channel configuration
CREATE TABLE public.instagram_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cod_agent text NOT NULL,
  client_id text NOT NULL,
  instagram_page_id text,
  instagram_user_id text,
  page_access_token text,
  is_active boolean NOT NULL DEFAULT false,
  page_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on instagram_config" ON public.instagram_config FOR ALL USING (true) WITH CHECK (true);

-- Add indexes
CREATE INDEX idx_webchat_sessions_visitor ON public.webchat_sessions(visitor_id);
CREATE INDEX idx_webchat_sessions_cod_agent ON public.webchat_sessions(cod_agent);
CREATE INDEX idx_webchat_config_cod_agent ON public.webchat_config(cod_agent);
CREATE INDEX idx_instagram_config_cod_agent ON public.instagram_config(cod_agent);
