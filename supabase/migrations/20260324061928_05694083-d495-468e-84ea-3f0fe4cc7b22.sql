
-- Create webhook_queue table
CREATE TABLE public.webhook_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waba_id text,
  phone_number_id text,
  from_number text,
  message_id text,
  message_type text DEFAULT 'text',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  contacts jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  retries integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error_message text,
  n8n_response_status integer
);

-- RLS
ALTER TABLE public.webhook_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on webhook_queue" ON public.webhook_queue FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_queue;

-- Unique index for deduplication
CREATE UNIQUE INDEX idx_webhook_queue_message_id ON public.webhook_queue (message_id) WHERE message_id IS NOT NULL;

-- Add richer columns to webhook_logs
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS message_id text,
  ADD COLUMN IF NOT EXISTS message_type text,
  ADD COLUMN IF NOT EXISTS status_type text,
  ADD COLUMN IF NOT EXISTS waba_id text,
  ADD COLUMN IF NOT EXISTS phone_number_id text;
