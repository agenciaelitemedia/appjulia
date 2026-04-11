
-- =============================================
-- Tabela: queues (Filas de Atendimento)
-- =============================================
CREATE TABLE public.queues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id text NOT NULL,
  name text NOT NULL,
  channel_type text NOT NULL DEFAULT 'uazapi',
  hub text,
  evo_url text,
  evo_apikey text,
  evo_instance text,
  waba_id text,
  waba_token text,
  waba_number_id text,
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on queues"
  ON public.queues FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_queues_updated_at
  BEFORE UPDATE ON public.queues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chat_contacts_updated_at();

-- =============================================
-- Tabela: queue_agent_links (Vínculo Fila ↔ Agente)
-- =============================================
CREATE TABLE public.queue_agent_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id uuid NOT NULL REFERENCES public.queues(id) ON DELETE RESTRICT,
  cod_agent text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique: um agente só pode estar vinculado a uma fila uma vez
CREATE UNIQUE INDEX uq_queue_agent ON public.queue_agent_links (queue_id, cod_agent);

-- Unique parcial: um agente só pode ter UMA fila primária
CREATE UNIQUE INDEX uq_agent_primary_queue ON public.queue_agent_links (cod_agent) WHERE is_primary = true;

ALTER TABLE public.queue_agent_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on queue_agent_links"
  ON public.queue_agent_links FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================
-- Adicionar queue_id em chat_conversations
-- =============================================
ALTER TABLE public.chat_conversations
  ADD COLUMN queue_id uuid REFERENCES public.queues(id);

-- =============================================
-- Adicionar queue_id em instagram_config
-- =============================================
ALTER TABLE public.instagram_config
  ADD COLUMN queue_id uuid REFERENCES public.queues(id);
