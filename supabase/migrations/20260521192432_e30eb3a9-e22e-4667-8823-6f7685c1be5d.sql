CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.client_ai_model_config_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature TEXT NOT NULL,
  label TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_model_list_feature ON public.client_ai_model_config_list(feature, sort_order);

ALTER TABLE public.client_ai_model_config_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read ai model list"
ON public.client_ai_model_config_list FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert ai model list"
ON public.client_ai_model_config_list FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update ai model list"
ON public.client_ai_model_config_list FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete ai model list"
ON public.client_ai_model_config_list FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_ai_model_list_updated_at
BEFORE UPDATE ON public.client_ai_model_config_list
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();