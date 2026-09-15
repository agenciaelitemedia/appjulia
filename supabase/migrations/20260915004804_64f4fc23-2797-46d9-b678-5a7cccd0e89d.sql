CREATE TABLE public.chat_queue_migrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL,
  from_queue_id UUID NOT NULL,
  from_queue_name TEXT,
  to_queue_id UUID NOT NULL,
  to_queue_name TEXT,
  actor_name TEXT,
  actor_user_id BIGINT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  assignee_mode TEXT NOT NULL DEFAULT 'keep',
  analyzed_count INTEGER NOT NULL DEFAULT 0,
  migrated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  contacts_moved INTEGER NOT NULL DEFAULT 0,
  batch_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_queue_migrations TO authenticated;
GRANT ALL ON public.chat_queue_migrations TO service_role;

ALTER TABLE public.chat_queue_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_queue_migrations_authenticated_all"
ON public.chat_queue_migrations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE INDEX idx_chat_queue_migrations_client_created ON public.chat_queue_migrations (client_id, created_at DESC);
CREATE INDEX idx_chat_queue_migrations_from_queue ON public.chat_queue_migrations (from_queue_id);
CREATE INDEX idx_chat_queue_migrations_batch ON public.chat_queue_migrations (batch_id);

CREATE TRIGGER update_chat_queue_migrations_updated_at
BEFORE UPDATE ON public.chat_queue_migrations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();