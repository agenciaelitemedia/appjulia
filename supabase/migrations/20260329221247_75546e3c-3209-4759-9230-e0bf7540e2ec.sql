ALTER TABLE contract_notification_configs
  ADD COLUMN IF NOT EXISTS step_cadence jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS msg_cadence jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS title_cadence jsonb DEFAULT '{}';