-- Add recording columns to video_call_records
ALTER TABLE video_call_records 
ADD COLUMN recording_id text,
ADD COLUMN recording_status text DEFAULT 'none';

-- Create index for faster lookups
CREATE INDEX idx_video_call_records_recording_id 
ON video_call_records(recording_id);