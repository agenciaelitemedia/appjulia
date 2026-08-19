CREATE TABLE public.alert_crm_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT,
  cod_agent TEXT NOT NULL,
  trigger_key TEXT NOT NULL,
  lead_phone TEXT,
  lead_name TEXT,
  business_name TEXT,
  owner_name TEXT,
  crm_stage_label TEXT,
  log_id UUID,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by TEXT,
  stage_entered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT alert_crm_cards_status_chk CHECK (status IN ('open','recovered','lost'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_crm_cards TO authenticated;
GRANT ALL ON public.alert_crm_cards TO service_role;

ALTER TABLE public.alert_crm_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage alert crm cards"
ON public.alert_crm_cards FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX alert_crm_cards_open_unique
  ON public.alert_crm_cards (cod_agent, lead_phone, trigger_key)
  WHERE status = 'open';

CREATE INDEX alert_crm_cards_status_created_idx ON public.alert_crm_cards (status, created_at DESC);
CREATE INDEX alert_crm_cards_agent_idx ON public.alert_crm_cards (cod_agent);
CREATE INDEX alert_crm_cards_trigger_idx ON public.alert_crm_cards (trigger_key);

CREATE TABLE public.alert_crm_card_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.alert_crm_cards(id) ON DELETE CASCADE,
  action_text TEXT NOT NULL,
  created_by_name TEXT,
  created_by_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_crm_card_actions TO authenticated;
GRANT ALL ON public.alert_crm_card_actions TO service_role;

ALTER TABLE public.alert_crm_card_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage alert crm card actions"
ON public.alert_crm_card_actions FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX alert_crm_card_actions_card_idx ON public.alert_crm_card_actions (card_id, created_at DESC);

CREATE TRIGGER alert_crm_cards_set_updated_at
BEFORE UPDATE ON public.alert_crm_cards
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();