CREATE TABLE public.chat_inbound_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL DEFAULT 'uazapi',
  queue_id uuid,
  client_id text,
  event_name text,
  dedupe_key text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  locked_at timestamptz,
  processed_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX chat_inbound_queue_dedupe_idx ON public.chat_inbound_queue (dedupe_key);
CREATE INDEX chat_inbound_queue_pending_idx ON public.chat_inbound_queue (status, next_attempt_at);

GRANT ALL ON public.chat_inbound_queue TO service_role;

ALTER TABLE public.chat_inbound_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages inbound queue"
ON public.chat_inbound_queue FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER chat_inbound_queue_updated_at
BEFORE UPDATE ON public.chat_inbound_queue
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();