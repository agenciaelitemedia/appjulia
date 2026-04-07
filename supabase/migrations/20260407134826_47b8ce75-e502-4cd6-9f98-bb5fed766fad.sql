
-- Stages table
CREATE TABLE public.crm_comercial_stages (
  id serial PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.crm_comercial_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on crm_comercial_stages" ON public.crm_comercial_stages FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.crm_comercial_stages (name, color, position) VALUES
  ('Interessados', '#3b82f6', 1),
  ('Agendar Reunião', '#f59e0b', 2),
  ('Reunião Agendada', '#8b5cf6', 3),
  ('Remarcar Reunião', '#f97316', 4),
  ('Proposta', '#06b6d4', 5),
  ('Fechado', '#10b981', 6),
  ('Perda', '#ef4444', 7);

-- Cards table
CREATE TABLE public.crm_comercial_cards (
  id serial PRIMARY KEY,
  stage_id integer NOT NULL REFERENCES public.crm_comercial_stages(id),
  contact_name text NOT NULL DEFAULT '',
  contact_phone text,
  contact_email text,
  company_name text,
  notes text,
  value numeric DEFAULT 0,
  created_by integer,
  assigned_to integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  stage_entered_at timestamptz DEFAULT now()
);

ALTER TABLE public.crm_comercial_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on crm_comercial_cards" ON public.crm_comercial_cards FOR ALL USING (true) WITH CHECK (true);

-- History table
CREATE TABLE public.crm_comercial_history (
  id serial PRIMARY KEY,
  card_id integer NOT NULL REFERENCES public.crm_comercial_cards(id) ON DELETE CASCADE,
  from_stage_id integer REFERENCES public.crm_comercial_stages(id),
  to_stage_id integer NOT NULL REFERENCES public.crm_comercial_stages(id),
  changed_by integer,
  changed_at timestamptz DEFAULT now(),
  notes text
);

ALTER TABLE public.crm_comercial_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on crm_comercial_history" ON public.crm_comercial_history FOR ALL USING (true) WITH CHECK (true);

-- Auto-update updated_at on cards
CREATE TRIGGER update_crm_comercial_cards_updated_at
  BEFORE UPDATE ON public.crm_comercial_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_updated_at();
