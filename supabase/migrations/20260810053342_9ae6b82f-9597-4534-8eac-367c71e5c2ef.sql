ALTER TABLE public.xj_provider_settings DROP CONSTRAINT IF EXISTS xj_provider_settings_kind_check;
ALTER TABLE public.xj_provider_settings ADD CONSTRAINT xj_provider_settings_kind_check CHECK (kind IN ('llm','voice','contract'));

ALTER TABLE public.xj_client_provider_keys DROP CONSTRAINT IF EXISTS xj_client_provider_keys_kind_check;
ALTER TABLE public.xj_client_provider_keys ADD CONSTRAINT xj_client_provider_keys_kind_check CHECK (kind IN ('llm','voice','contract'));

INSERT INTO public.xj_provider_settings (provider, kind, is_enabled, default_key)
VALUES ('zapsign', 'contract', true, '1c34c87a-37d6-42c3-add9-b3ceaed8eb1d13d47d17-4386-407b-aee9-665af342b622')
ON CONFLICT (provider, kind) DO NOTHING;

ALTER TABLE public.xj_agents ADD COLUMN IF NOT EXISTS contract_api_token text;

ALTER TABLE public.xj_contracts ADD COLUMN IF NOT EXISTS template_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'xj_contracts_template_id_fkey') THEN
    ALTER TABLE public.xj_contracts
      ADD CONSTRAINT xj_contracts_template_id_fkey
      FOREIGN KEY (template_id) REFERENCES public.xj_zapsign_templates(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'xj_zapsign_templates_case_id_fkey') THEN
    ALTER TABLE public.xj_zapsign_templates
      ADD CONSTRAINT xj_zapsign_templates_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.xj_legal_cases(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'xj_zapsign_templates_agent_id_fkey') THEN
    ALTER TABLE public.xj_zapsign_templates
      ADD CONSTRAINT xj_zapsign_templates_agent_id_fkey
      FOREIGN KEY (agent_id) REFERENCES public.xj_agents(id) ON DELETE SET NULL;
  END IF;
END $$;