
-- 1. Garantir coluna assigned_to em crm_deals
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS assigned_to text;

-- 2. Índice para busca rápida do deal pelo conversation_id contido em custom_fields
CREATE INDEX IF NOT EXISTS idx_crm_deals_chat_link
  ON public.crm_deals USING GIN ((custom_fields -> 'links' -> 'chat'));

-- 3. Funções de mapeamento de prioridade
CREATE OR REPLACE FUNCTION public.map_priority_chat_to_crm(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p = 'normal' THEN 'medium'
    WHEN p IN ('low','medium','high','urgent') THEN p
    ELSE 'medium'
  END;
$$;

CREATE OR REPLACE FUNCTION public.map_priority_crm_to_chat(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p = 'medium' THEN 'normal'
    WHEN p IN ('low','high','urgent') THEN p
    ELSE 'normal'
  END;
$$;

-- 4. Trigger: deal -> conversa
CREATE OR REPLACE FUNCTION public.sync_deal_to_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
  v_new_priority text;
BEGIN
  -- Evita recursão entre os dois triggers
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  v_conv_id := NULLIF(NEW.custom_fields #>> '{links,chat,conversation_id}', '')::uuid;
  IF v_conv_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_new_priority := public.map_priority_crm_to_chat(NEW.priority::text);

  UPDATE public.chat_conversations
     SET assigned_to = NEW.assigned_to,
         priority    = v_new_priority,
         updated_at  = now()
   WHERE id = v_conv_id
     AND (
       assigned_to IS DISTINCT FROM NEW.assigned_to
       OR priority::text IS DISTINCT FROM v_new_priority
     );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_deal_to_conversation ON public.crm_deals;
CREATE TRIGGER trg_sync_deal_to_conversation
AFTER UPDATE OF assigned_to, priority, custom_fields ON public.crm_deals
FOR EACH ROW
EXECUTE FUNCTION public.sync_deal_to_conversation();

-- 5. Trigger: conversa -> deal
CREATE OR REPLACE FUNCTION public.sync_conversation_to_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_priority text;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  v_new_priority := public.map_priority_chat_to_crm(NEW.priority::text);

  UPDATE public.crm_deals d
     SET assigned_to = NEW.assigned_to,
         priority    = v_new_priority,
         updated_at  = now()
   WHERE (d.custom_fields #>> '{links,chat,conversation_id}') = NEW.id::text
     AND (
       d.assigned_to IS DISTINCT FROM NEW.assigned_to
       OR d.priority::text IS DISTINCT FROM v_new_priority
     );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_conversation_to_deal ON public.chat_conversations;
CREATE TRIGGER trg_sync_conversation_to_deal
AFTER UPDATE OF assigned_to, priority ON public.chat_conversations
FOR EACH ROW
EXECUTE FUNCTION public.sync_conversation_to_deal();

-- 6. Backfill inicial: cards vinculados herdam dados da conversa
UPDATE public.crm_deals d
   SET assigned_to = c.assigned_to,
       priority    = public.map_priority_chat_to_crm(c.priority::text),
       updated_at  = now()
  FROM public.chat_conversations c
 WHERE (d.custom_fields #>> '{links,chat,conversation_id}') = c.id::text
   AND (
     d.assigned_to IS DISTINCT FROM c.assigned_to
     OR d.priority::text IS DISTINCT FROM public.map_priority_chat_to_crm(c.priority::text)
   );
