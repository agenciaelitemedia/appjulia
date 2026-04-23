-- ============================================
-- UaZapi history queue (replaces whatsapp_sync_jobs for history events)
-- ============================================

CREATE TABLE IF NOT EXISTS public.uazapi_history_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  client_name TEXT,
  queue_id UUID,
  queue_name TEXT,
  event TEXT NOT NULL DEFAULT 'history',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | running | done | partial | error
  total_messages INT NOT NULL DEFAULT 0,
  group_messages INT NOT NULL DEFAULT 0,
  individual_chats INT NOT NULL DEFAULT 0,
  processed_chats INT NOT NULL DEFAULT 0,
  inserted_messages INT NOT NULL DEFAULT 0,
  duplicate_messages INT NOT NULL DEFAULT 0,
  inserted_contacts INT NOT NULL DEFAULT 0,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uazapi_history_runs_client ON public.uazapi_history_runs(client_id);
CREATE INDEX IF NOT EXISTS idx_uazapi_history_runs_queue ON public.uazapi_history_runs(queue_id);
CREATE INDEX IF NOT EXISTS idx_uazapi_history_runs_status ON public.uazapi_history_runs(status);
CREATE INDEX IF NOT EXISTS idx_uazapi_history_runs_received ON public.uazapi_history_runs(received_at DESC);

CREATE TABLE IF NOT EXISTS public.uazapi_history_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.uazapi_history_runs(id) ON DELETE CASCADE,
  remote_jid TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | ok | skipped | error
  received_messages INT NOT NULL DEFAULT 0,
  inserted_messages INT NOT NULL DEFAULT 0,
  duplicate_messages INT NOT NULL DEFAULT 0,
  contact_created BOOLEAN NOT NULL DEFAULT false,
  conversation_created BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, remote_jid)
);

CREATE INDEX IF NOT EXISTS idx_uazapi_history_items_run ON public.uazapi_history_items(run_id);
CREATE INDEX IF NOT EXISTS idx_uazapi_history_items_status ON public.uazapi_history_items(status);

CREATE TRIGGER trg_uazapi_history_runs_updated_at
BEFORE UPDATE ON public.uazapi_history_runs
FOR EACH ROW EXECUTE FUNCTION public.update_chat_contacts_updated_at();

ALTER TABLE public.uazapi_history_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uazapi_history_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read history runs" ON public.uazapi_history_runs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write history runs" ON public.uazapi_history_runs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read history items" ON public.uazapi_history_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write history items" ON public.uazapi_history_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.uazapi_history_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.uazapi_history_items;