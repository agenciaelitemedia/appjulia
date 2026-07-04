
-- Fila de reconciliação após terminal
CREATE TABLE IF NOT EXISTS public.wavoip_reconcile_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_call_id text NOT NULL,
  run_after timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | done | error
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wavoip_reconcile_queue_due_idx
  ON public.wavoip_reconcile_queue (status, run_after)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS wavoip_reconcile_queue_wid_pending_uidx
  ON public.wavoip_reconcile_queue (whatsapp_call_id)
  WHERE status = 'pending';

GRANT ALL ON public.wavoip_reconcile_queue TO service_role;

ALTER TABLE public.wavoip_reconcile_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role only" ON public.wavoip_reconcile_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Política pública de leitura para o bucket de gravações
DROP POLICY IF EXISTS "Public read wavoip recordings" ON storage.objects;
CREATE POLICY "Public read wavoip recordings"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'wavoip-recordings');
