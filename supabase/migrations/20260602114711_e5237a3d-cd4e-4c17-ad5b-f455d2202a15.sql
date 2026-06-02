
CREATE TABLE public.waba_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  queue_id uuid NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
  waba_id text NOT NULL,
  meta_template_id text NOT NULL,
  name text NOT NULL,
  language text NOT NULL,
  category text NOT NULL,
  sub_category text,
  status text NOT NULL,
  rejection_reason text,
  quality_score jsonb,
  components jsonb NOT NULL,
  last_edited_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (queue_id, name, language)
);

CREATE INDEX idx_waba_templates_queue ON public.waba_templates(queue_id);
CREATE INDEX idx_waba_templates_client ON public.waba_templates(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waba_templates TO authenticated;
GRANT ALL ON public.waba_templates TO service_role;

ALTER TABLE public.waba_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on waba_templates"
  ON public.waba_templates
  FOR ALL
  USING (true)
  WITH CHECK (true);
