
-- RLS policies for ticket-media bucket
-- Authenticated users can read/upload; service_role full access (implicit).
CREATE POLICY "ticket-media authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'ticket-media');

CREATE POLICY "ticket-media authenticated insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ticket-media');
