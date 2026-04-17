CREATE TABLE public.chat_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT[] NOT NULL DEFAULT ARRAY['conversation_created','message_received','conversation_resolved','conversation_assigned']::text[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on chat_webhooks" ON public.chat_webhooks FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_cw_client_active ON public.chat_webhooks(client_id, is_active);

CREATE TABLE public.chat_webhook_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on chat_webhook_deliveries" ON public.chat_webhook_deliveries FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_cwd_webhook ON public.chat_webhook_deliveries(webhook_id, delivered_at DESC);

CREATE TRIGGER update_chat_webhooks_updated_at
  BEFORE UPDATE ON public.chat_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_contacts_updated_at();