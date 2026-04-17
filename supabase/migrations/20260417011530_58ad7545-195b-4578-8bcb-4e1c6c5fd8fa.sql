CREATE TABLE public.chat_sla_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL,
  cod_agent TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  first_response_minutes INTEGER NOT NULL DEFAULT 15,
  resolution_minutes INTEGER NOT NULL DEFAULT 240,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (client_id, priority)
);

ALTER TABLE public.chat_sla_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on chat_sla_configs"
ON public.chat_sla_configs
FOR ALL
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_chat_sla_configs_updated_at
BEFORE UPDATE ON public.chat_sla_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_chat_contacts_updated_at();

CREATE INDEX idx_chat_sla_configs_client ON public.chat_sla_configs(client_id, is_active);