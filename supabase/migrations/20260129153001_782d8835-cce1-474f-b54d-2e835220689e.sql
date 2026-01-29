-- Add operator_id column to track which user answered the call
ALTER TABLE video_call_records 
ADD COLUMN operator_id integer;

-- Create index for efficient filtering by operator
CREATE INDEX idx_video_call_records_operator_id 
ON video_call_records(operator_id);