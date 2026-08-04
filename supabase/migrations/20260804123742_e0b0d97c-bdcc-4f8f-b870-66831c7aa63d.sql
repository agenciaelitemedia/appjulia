ALTER TABLE public.chat_bot_flows
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_version integer,
  ADD COLUMN IF NOT EXISTS published_nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published_edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published_start_node_id text;

CREATE TABLE IF NOT EXISTS public.chat_bot_flow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.chat_bot_flows(id) ON DELETE CASCADE,
  client_id text,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'archived',
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  start_node_id text,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_bot_flow_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_bot_flow_versions TO anon;
GRANT ALL ON public.chat_bot_flow_versions TO service_role;

ALTER TABLE public.chat_bot_flow_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_bot_flow_versions'
  ) THEN
    CREATE POLICY "chat_bot_flow_versions_all" ON public.chat_bot_flow_versions
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_bot_flow_versions_flow ON public.chat_bot_flow_versions(flow_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_chat_bot_flow_runs_flow_started ON public.chat_bot_flow_runs(flow_id, started_at DESC);

UPDATE public.chat_bot_flows
SET status = 'published',
    published_at = COALESCE(published_at, updated_at, now()),
    published_version = COALESCE(published_version, COALESCE(version, 1)),
    published_nodes = nodes,
    published_edges = edges,
    published_start_node_id = start_node_id
WHERE is_active = true AND status = 'draft';