
ALTER TABLE public.crm_boards ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE public.crm_pipelines ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE public.crm_custom_fields ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE public.crm_automation_rules ADD COLUMN IF NOT EXISTS client_id text;

-- Backfill: only one cod_agent (220249100) currently has data, mapped to client_id '97'
UPDATE public.crm_boards SET client_id = '97' WHERE client_id IS NULL AND cod_agent = '220249100';
UPDATE public.crm_pipelines SET client_id = '97' WHERE client_id IS NULL AND cod_agent = '220249100';
UPDATE public.crm_deals SET client_id = '97' WHERE client_id IS NULL AND cod_agent = '220249100';
UPDATE public.crm_custom_fields SET client_id = '97' WHERE client_id IS NULL AND cod_agent = '220249100';
UPDATE public.crm_automation_rules SET client_id = '97' WHERE client_id IS NULL AND cod_agent = '220249100';

CREATE INDEX IF NOT EXISTS idx_crm_boards_client_id ON public.crm_boards(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_pipelines_client_id ON public.crm_pipelines(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_client_id ON public.crm_deals(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_custom_fields_client_id ON public.crm_custom_fields(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_automation_rules_client_id ON public.crm_automation_rules(client_id);
