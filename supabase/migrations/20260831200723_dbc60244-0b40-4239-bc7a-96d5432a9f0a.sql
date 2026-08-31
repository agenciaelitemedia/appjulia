CREATE TABLE public.lidia_client_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  sales_profile JSONB NOT NULL DEFAULT '{}',
  silence_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lidia_client_config TO authenticated;
GRANT ALL ON public.lidia_client_config TO service_role;

ALTER TABLE public.lidia_client_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on lidia_client_config" ON public.lidia_client_config
  FOR ALL TO public
  USING (true)
  WITH CHECK (true);

CREATE TABLE public.lidia_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL,
  conversation_id UUID NOT NULL,
  phase TEXT NOT NULL DEFAULT 'abertura',
  last_analysis JSONB,
  confidence NUMERIC(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, conversation_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lidia_sessions TO authenticated;
GRANT ALL ON public.lidia_sessions TO service_role;

ALTER TABLE public.lidia_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on lidia_sessions" ON public.lidia_sessions
  FOR ALL TO public
  USING (true)
  WITH CHECK (true);

CREATE TABLE public.lidia_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL,
  conversation_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lidia_messages TO authenticated;
GRANT ALL ON public.lidia_messages TO service_role;

ALTER TABLE public.lidia_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on lidia_messages" ON public.lidia_messages
  FOR ALL TO public
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_lidia_sessions_conversation ON public.lidia_sessions(client_id, conversation_id);
CREATE INDEX idx_lidia_messages_conversation ON public.lidia_messages(client_id, conversation_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_lidia_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_lidia_client_config_updated_at
  BEFORE UPDATE ON public.lidia_client_config
  FOR EACH ROW EXECUTE FUNCTION public.update_lidia_updated_at_column();

CREATE TRIGGER update_lidia_sessions_updated_at
  BEFORE UPDATE ON public.lidia_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_lidia_updated_at_column();