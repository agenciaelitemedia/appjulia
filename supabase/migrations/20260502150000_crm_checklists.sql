-- Checklists dentro de cards do CRM Builder
CREATE TABLE IF NOT EXISTS public.crm_checklists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  title       text NOT NULL,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Itens de cada checklist
CREATE TABLE IF NOT EXISTS public.crm_checklist_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id  uuid NOT NULL REFERENCES public.crm_checklists(id) ON DELETE CASCADE,
  deal_id       uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  title         text NOT NULL,
  is_completed  boolean NOT NULL DEFAULT false,
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_checklists_deal_id_idx           ON public.crm_checklists(deal_id);
CREATE INDEX IF NOT EXISTS crm_checklist_items_checklist_id_idx ON public.crm_checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS crm_checklist_items_deal_id_idx      ON public.crm_checklist_items(deal_id);

-- Habilita Realtime nas tabelas para atualizações em tempo real na UI
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_checklists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_checklist_items;
