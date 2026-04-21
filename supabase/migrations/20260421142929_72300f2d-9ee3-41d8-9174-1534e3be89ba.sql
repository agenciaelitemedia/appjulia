-- Align chat_client_settings RLS with the rest of chat_* tables (custom auth, not Supabase Auth)
ALTER TABLE public.chat_client_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view chat client settings" ON public.chat_client_settings;
DROP POLICY IF EXISTS "Authenticated can insert chat client settings" ON public.chat_client_settings;
DROP POLICY IF EXISTS "Authenticated can update chat client settings" ON public.chat_client_settings;
DROP POLICY IF EXISTS "Authenticated can delete chat client settings" ON public.chat_client_settings;
DROP POLICY IF EXISTS "Authenticated users can view chat client settings" ON public.chat_client_settings;
DROP POLICY IF EXISTS "Authenticated users can insert chat client settings" ON public.chat_client_settings;
DROP POLICY IF EXISTS "Authenticated users can update chat client settings" ON public.chat_client_settings;
DROP POLICY IF EXISTS "Authenticated users can delete chat client settings" ON public.chat_client_settings;
DROP POLICY IF EXISTS "Allow all on chat_client_settings" ON public.chat_client_settings;

CREATE POLICY "Allow all on chat_client_settings"
  ON public.chat_client_settings FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);