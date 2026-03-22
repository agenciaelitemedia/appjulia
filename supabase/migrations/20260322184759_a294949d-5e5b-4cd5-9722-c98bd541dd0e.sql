ALTER TABLE phone_extensions ADD COLUMN IF NOT EXISTS api4com_email text;
ALTER TABLE phone_extensions ADD COLUMN IF NOT EXISTS api4com_first_name text;
ALTER TABLE phone_extensions ADD COLUMN IF NOT EXISTS api4com_last_name text;
ALTER TABLE phone_extensions ADD COLUMN IF NOT EXISTS api4com_raw jsonb DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_extensions_agent_member ON phone_extensions (cod_agent, assigned_member_id) WHERE assigned_member_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_extensions_agent_ramal ON phone_extensions (cod_agent, api4com_ramal) WHERE api4com_ramal IS NOT NULL;