CREATE TABLE IF NOT EXISTS public.chat_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  cod_agent text,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  trigger_type text NOT NULL DEFAULT 'keyword',
  trigger_keywords text[] NOT NULL DEFAULT '{}',
  match_mode text NOT NULL DEFAULT 'contains',
  response_text text NOT NULL,
  handoff_to_human boolean NOT NULL DEFAULT false,
  only_business_hours boolean NOT NULL DEFAULT false,
  execution_count integer NOT NULL DEFAULT 0,
  last_executed_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_bots open access" ON public.chat_bots FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_chat_bots_client ON public.chat_bots(client_id, is_active);

CREATE TABLE IF NOT EXISTS public.chat_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  cod_agent text,
  name text NOT NULL,
  message_text text NOT NULL,
  media_url text,
  media_type text,
  status text NOT NULL DEFAULT 'draft',
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  filter_tags text[] NOT NULL DEFAULT '{}',
  filter_channel text,
  contacts_total integer NOT NULL DEFAULT 0,
  contacts_sent integer NOT NULL DEFAULT 0,
  contacts_failed integer NOT NULL DEFAULT 0,
  throttle_seconds integer NOT NULL DEFAULT 5,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_campaigns open access" ON public.chat_campaigns FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.chat_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.chat_campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_campaign_recipients open access" ON public.chat_campaign_recipients FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_camp ON public.chat_campaign_recipients(campaign_id, status);