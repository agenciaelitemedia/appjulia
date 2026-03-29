ALTER TABLE contract_notification_configs
  ADD COLUMN IF NOT EXISTS trigger_cadence jsonb DEFAULT '{}'::jsonb;