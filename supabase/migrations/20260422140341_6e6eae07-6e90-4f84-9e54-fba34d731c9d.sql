
-- Tabela principal de jobs de sincronização
CREATE TABLE public.whatsapp_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  client_name TEXT,
  queue_id UUID,
  queue_name TEXT,
  cod_agent TEXT,
  agent_name TEXT,
  phase TEXT NOT NULL DEFAULT 'message_find', -- 'history_sync' | 'message_find'
  status TEXT NOT NULL DEFAULT 'running',     -- 'running' | 'done' | 'error' | 'partial' | 'cancelled'
  date_from DATE,
  date_to DATE,
  total_numbers INT NOT NULL DEFAULT 0,
  processed_numbers INT NOT NULL DEFAULT 0,
  inserted_messages INT NOT NULL DEFAULT 0,
  inserted_contacts INT NOT NULL DEFAULT 0,
  evo_url TEXT,
  evo_token TEXT,
  numbers JSONB NOT NULL DEFAULT '[]'::jsonb,
  cancel_requested BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_sync_jobs_client ON public.whatsapp_sync_jobs(client_id);
CREATE INDEX idx_whatsapp_sync_jobs_status ON public.whatsapp_sync_jobs(status);
CREATE INDEX idx_whatsapp_sync_jobs_created_at ON public.whatsapp_sync_jobs(created_at DESC);

-- Tabela de logs por número
CREATE TABLE public.whatsapp_sync_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.whatsapp_sync_jobs(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'ok' | 'error' | 'skipped'
  messages_found INT NOT NULL DEFAULT 0,
  messages_inserted INT NOT NULL DEFAULT 0,
  contact_created BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, phone)
);

CREATE INDEX idx_whatsapp_sync_job_logs_job ON public.whatsapp_sync_job_logs(job_id);
CREATE INDEX idx_whatsapp_sync_job_logs_status ON public.whatsapp_sync_job_logs(status);

-- Trigger para updated_at
CREATE TRIGGER trg_whatsapp_sync_jobs_updated_at
BEFORE UPDATE ON public.whatsapp_sync_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_chat_contacts_updated_at();

-- RLS
ALTER TABLE public.whatsapp_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sync_job_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all jobs (back-office tool)
CREATE POLICY "Authenticated can view sync jobs"
ON public.whatsapp_sync_jobs FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated can insert sync jobs"
ON public.whatsapp_sync_jobs FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update sync jobs"
ON public.whatsapp_sync_jobs FOR UPDATE
TO authenticated USING (true);

CREATE POLICY "Authenticated can delete sync jobs"
ON public.whatsapp_sync_jobs FOR DELETE
TO authenticated USING (true);

CREATE POLICY "Authenticated can view sync job logs"
ON public.whatsapp_sync_job_logs FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated can insert sync job logs"
ON public.whatsapp_sync_job_logs FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update sync job logs"
ON public.whatsapp_sync_job_logs FOR UPDATE
TO authenticated USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_sync_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_sync_job_logs;
