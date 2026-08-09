CREATE TABLE IF NOT EXISTS public.xj_model_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model text NOT NULL,
  input_per_1m numeric NOT NULL DEFAULT 0,
  output_per_1m numeric NOT NULL DEFAULT 0,
  context_tokens integer NOT NULL DEFAULT 0,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, model)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xj_model_pricing TO authenticated;
GRANT SELECT ON public.xj_model_pricing TO anon;
GRANT ALL ON public.xj_model_pricing TO service_role;

ALTER TABLE public.xj_model_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xj_model_pricing_read" ON public.xj_model_pricing FOR SELECT USING (true);
CREATE POLICY "xj_model_pricing_write" ON public.xj_model_pricing FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER xj_model_pricing_touch
BEFORE UPDATE ON public.xj_model_pricing
FOR EACH ROW EXECUTE FUNCTION public.xj_touch_updated_at();