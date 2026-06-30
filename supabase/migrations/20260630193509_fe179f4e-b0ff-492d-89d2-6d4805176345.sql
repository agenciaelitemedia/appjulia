
ALTER TABLE public.wavoip_call_logs
  ADD COLUMN IF NOT EXISTS whatsapp_call_id text,
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS recording_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS recording_downloaded_at timestamptz;

CREATE INDEX IF NOT EXISTS wavoip_call_logs_whatsapp_call_id_idx
  ON public.wavoip_call_logs (whatsapp_call_id);

-- Realtime para histórico
ALTER PUBLICATION supabase_realtime ADD TABLE public.wavoip_call_logs;

-- Storage RLS (bucket wavoip-recordings já criado via tool)
DROP POLICY IF EXISTS "wavoip_recordings_read_authenticated" ON storage.objects;
CREATE POLICY "wavoip_recordings_read_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'wavoip-recordings');
