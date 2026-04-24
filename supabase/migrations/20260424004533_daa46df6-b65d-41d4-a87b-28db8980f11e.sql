DROP POLICY IF EXISTS "Authenticated read history runs" ON public.uazapi_history_runs;
DROP POLICY IF EXISTS "Authenticated read history items" ON public.uazapi_history_items;

CREATE POLICY "Public read history runs"
  ON public.uazapi_history_runs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public read history items"
  ON public.uazapi_history_items FOR SELECT
  TO anon, authenticated
  USING (true);