
-- Create julia_plans table
CREATE TABLE public.julia_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  price_display text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'zap',
  color text NOT NULL DEFAULT 'from-blue-500 to-blue-600',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_popular boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.julia_plans ENABLE ROW LEVEL SECURITY;

-- Public read access (checkout page)
CREATE POLICY "Public read julia_plans" ON public.julia_plans
  FOR SELECT USING (true);

-- Public write access (admin panel)
CREATE POLICY "Public write julia_plans" ON public.julia_plans
  FOR ALL USING (true) WITH CHECK (true);

-- Seed initial plans
INSERT INTO public.julia_plans (name, price, price_display, icon, color, features, is_popular, position) VALUES
  ('Plano Essencial', 29700, 'R$ 297', 'zap', 'from-blue-500 to-blue-600', '["Até 500 leads/mês", "Atendimento WhatsApp IA", "CRM básico incluso", "Suporte por e-mail"]'::jsonb, false, 0),
  ('Plano Profissional', 49700, 'R$ 497', 'star', 'from-[#6C3AED] to-[#7C3AED]', '["Até 2.000 leads/mês", "Atendimento WhatsApp IA", "CRM completo + automações", "Relatórios avançados", "Suporte prioritário"]'::jsonb, true, 1),
  ('Plano Enterprise', 99700, 'R$ 997', 'crown', 'from-amber-500 to-amber-600', '["Leads ilimitados", "Atendimento WhatsApp IA", "CRM completo + automações", "Multi-agentes", "API personalizada", "Gerente de conta dedicado"]'::jsonb, false, 2);
