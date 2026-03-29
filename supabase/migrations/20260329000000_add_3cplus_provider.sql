-- Add multi-provider support to phone_config and phone_extensions
-- Non-breaking: all new columns have defaults, existing api4com rows preserved

-- phone_config: add provider selection and 3C+ credentials
ALTER TABLE phone_config
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'api4com',
  ADD COLUMN IF NOT EXISTS threecplus_token TEXT,
  ADD COLUMN IF NOT EXISTS threecplus_base_url TEXT DEFAULT 'https://app.3c.fluxoti.com/api/v1',
  ADD COLUMN IF NOT EXISTS threecplus_ws_url TEXT DEFAULT 'wss://events.3c.fluxoti.com/ws/me';

-- phone_extensions: add provider tag and 3C+ extension fields
ALTER TABLE phone_extensions
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'api4com',
  ADD COLUMN IF NOT EXISTS threecplus_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS threecplus_extension TEXT,
  ADD COLUMN IF NOT EXISTS threecplus_sip_username TEXT,
  ADD COLUMN IF NOT EXISTS threecplus_sip_password TEXT,
  ADD COLUMN IF NOT EXISTS threecplus_sip_domain TEXT,
  ADD COLUMN IF NOT EXISTS threecplus_raw JSONB;

-- Ensure existing rows are marked as api4com
UPDATE phone_config SET provider = 'api4com' WHERE provider IS NULL OR provider = '';
UPDATE phone_extensions SET provider = 'api4com' WHERE provider IS NULL OR provider = '';
