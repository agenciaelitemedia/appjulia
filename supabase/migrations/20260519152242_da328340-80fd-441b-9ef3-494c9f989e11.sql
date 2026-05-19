CREATE TABLE public.chat_bulk_close_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  actor_identifier text,
  actor_name text,
  conversation_id uuid NOT NULL,
  protocol text,
  contact_id uuid,
  queue_id uuid,
  assignment_type text NOT NULL CHECK (assignment_type IN ('julia','human')),
  previous_status text,
  previous_assigned_to text,
  batch_id uuid NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  closed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bulk_close_logs_client_closed ON public.chat_bulk_close_logs (client_id, closed_at DESC);
CREATE INDEX idx_bulk_close_logs_batch ON public.chat_bulk_close_logs (batch_id);
CREATE INDEX idx_bulk_close_logs_conv ON public.chat_bulk_close_logs (conversation_id);

ALTER TABLE public.chat_bulk_close_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read bulk close logs"
ON public.chat_bulk_close_logs
FOR SELECT
TO authenticated
USING (true);