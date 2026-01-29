-- Create video_call_records table for call history
CREATE TABLE public.video_call_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_name TEXT NOT NULL,
  lead_id BIGINT,
  cod_agent TEXT NOT NULL,
  operator_name TEXT,
  contact_name TEXT,
  whatsapp_number TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_video_call_records_cod_agent ON public.video_call_records(cod_agent);
CREATE INDEX idx_video_call_records_created_at ON public.video_call_records(created_at DESC);
CREATE INDEX idx_video_call_records_room_name ON public.video_call_records(room_name);
CREATE INDEX idx_video_call_records_status ON public.video_call_records(status);

-- Enable RLS
ALTER TABLE public.video_call_records ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access (edge functions)
CREATE POLICY "Service role has full access to video_call_records"
ON public.video_call_records
FOR ALL
USING (true)
WITH CHECK (true);