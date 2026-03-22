
-- First clean duplicates keeping only one per call_id
DELETE FROM phone_call_logs a
USING phone_call_logs b
WHERE a.id > b.id AND a.call_id IS NOT NULL AND a.call_id = b.call_id;

-- Add unique constraint
ALTER TABLE phone_call_logs ADD CONSTRAINT phone_call_logs_call_id_unique UNIQUE (call_id);
