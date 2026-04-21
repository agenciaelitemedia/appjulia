-- Tabela de configurações de chat por cliente
CREATE TABLE public.chat_client_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL UNIQUE,
  client_name TEXT,
  client_business_name TEXT,
  settings JSONB NOT NULL DEFAULT '{"QUEUE_LIMIT": 1, "ALLOW_GROUPS": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_client_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view chat client settings"
  ON public.chat_client_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert chat client settings"
  ON public.chat_client_settings FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update chat client settings"
  ON public.chat_client_settings FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete chat client settings"
  ON public.chat_client_settings FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER update_chat_client_settings_updated_at
  BEFORE UPDATE ON public.chat_client_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_contacts_updated_at();