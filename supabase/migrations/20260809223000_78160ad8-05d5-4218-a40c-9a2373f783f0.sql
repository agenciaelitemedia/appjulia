-- X-Julia — skill ZapSign: modelo (.docx) real, variáveis, pasta por escritório.

-- Permite um novo "kind" de provider settings/keys para o token de assinatura (ZapSign).
ALTER TABLE public.xj_provider_settings DROP CONSTRAINT IF EXISTS xj_provider_settings_kind_check;
ALTER TABLE public.xj_provider_settings ADD CONSTRAINT xj_provider_settings_kind_check CHECK (kind IN ('llm','voice','contract'));

ALTER TABLE public.xj_client_provider_keys DROP CONSTRAINT IF EXISTS xj_client_provider_keys_kind_check;
ALTER TABLE public.xj_client_provider_keys ADD CONSTRAINT xj_client_provider_keys_kind_check CHECK (kind IN ('llm','voice','contract'));

-- Token padrão do ZapSign (pode ser sobrescrito por escritório em xj_client_provider_keys
-- ou por agente especialista em xj_agents.contract_api_token).
INSERT INTO public.xj_provider_settings (provider, kind, is_enabled, default_key)
VALUES ('zapsign', 'contract', true, '1c34c87a-37d6-42c3-add9-b3ceaed8eb1d13d47d17-4386-407b-aee9-665af342b622')
ON CONFLICT (provider, kind) DO NOTHING;

-- Override do token por agente especialista.
ALTER TABLE public.xj_agents ADD COLUMN IF NOT EXISTS contract_api_token text;

-- Modelo (.docx) enviado ao ZapSign para um caso jurídico, com variáveis descobertas
-- e o mapeamento delas para os campos de dados do caso.
CREATE TABLE IF NOT EXISTS public.xj_zapsign_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  case_id uuid NOT NULL REFERENCES public.xj_legal_cases(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.xj_agents(id) ON DELETE SET NULL,
  template_token text NOT NULL,
  template_name text NOT NULL,
  folder_path text NOT NULL,
  docx_file_url text,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS xj_zapsign_templates_active_case
  ON public.xj_zapsign_templates(case_id) WHERE is_active;

GRANT ALL ON public.xj_zapsign_templates TO service_role;
ALTER TABLE public.xj_zapsign_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS xj_zapsign_templates_app_access ON public.xj_zapsign_templates;
CREATE POLICY xj_zapsign_templates_app_access ON public.xj_zapsign_templates
  FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_xj_zapsign_templates_updated ON public.xj_zapsign_templates;
CREATE TRIGGER trg_xj_zapsign_templates_updated
BEFORE UPDATE ON public.xj_zapsign_templates
FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();

-- Rastreabilidade: qual modelo ZapSign gerou o contrato.
ALTER TABLE public.xj_contracts ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.xj_zapsign_templates(id) ON DELETE SET NULL;
