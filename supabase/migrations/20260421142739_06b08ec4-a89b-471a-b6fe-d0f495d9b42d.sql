-- Ensure RLS is enabled
ALTER TABLE public.chat_client_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "Authenticated can view chat client settings" ON public.chat_client_settings;
DROP POLICY IF EXISTS "Authenticated can insert chat client settings" ON public.chat_client_settings;
DROP POLICY IF EXISTS "Authenticated can update chat client settings" ON public.chat_client_settings;
DROP POLICY IF EXISTS "Authenticated can delete chat client settings" ON public.chat_client_settings;

CREATE POLICY "Authenticated can view chat client settings"
  ON public.chat_client_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert chat client settings"
  ON public.chat_client_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update chat client settings"
  ON public.chat_client_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can delete chat client settings"
  ON public.chat_client_settings FOR DELETE
  TO authenticated
  USING (true);