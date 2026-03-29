ALTER TABLE contract_notification_configs
  ADD COLUMN IF NOT EXISTS target_numbers_config jsonb DEFAULT '[]'::jsonb;

-- Migrate existing data: convert target_numbers + trigger_event into target_numbers_config
UPDATE contract_notification_configs
SET target_numbers_config = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('phone', phone, 'trigger', COALESCE(trigger_event, 'BOTH'))), '[]'::jsonb)
  FROM unnest(target_numbers) AS phone
)
WHERE target_numbers IS NOT NULL AND array_length(target_numbers, 1) > 0;