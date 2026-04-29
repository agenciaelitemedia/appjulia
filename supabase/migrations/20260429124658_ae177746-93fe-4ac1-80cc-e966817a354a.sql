DROP POLICY IF EXISTS "Authenticated can view telephony_providers" ON public.telephony_providers;
DROP POLICY IF EXISTS "Authenticated can insert telephony_providers" ON public.telephony_providers;
DROP POLICY IF EXISTS "Authenticated can update telephony_providers" ON public.telephony_providers;
DROP POLICY IF EXISTS "Authenticated can delete telephony_providers" ON public.telephony_providers;

CREATE POLICY "Anyone can view telephony_providers"
  ON public.telephony_providers FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert telephony_providers"
  ON public.telephony_providers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update telephony_providers"
  ON public.telephony_providers FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete telephony_providers"
  ON public.telephony_providers FOR DELETE
  USING (true);