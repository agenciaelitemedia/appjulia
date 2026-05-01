-- 1) Trigger: ao atribuir responsável em conversa pendente, promover para 'open'
CREATE OR REPLACE FUNCTION public.auto_open_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND TRIM(NEW.assigned_to) <> ''
     AND (OLD.assigned_to IS NULL OR TRIM(OLD.assigned_to) = '' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
     AND NEW.status = 'pending'
  THEN
    NEW.status := 'open';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_conversations_auto_open ON public.chat_conversations;
CREATE TRIGGER trg_chat_conversations_auto_open
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW
EXECUTE FUNCTION public.auto_open_on_assignment();

-- Também cobrir INSERT (caso já venha com assigned_to setado)
CREATE OR REPLACE FUNCTION public.auto_open_on_insert_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND TRIM(NEW.assigned_to) <> ''
     AND NEW.status = 'pending'
  THEN
    NEW.status := 'open';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_conversations_auto_open_insert ON public.chat_conversations;
CREATE TRIGGER trg_chat_conversations_auto_open_insert
BEFORE INSERT ON public.chat_conversations
FOR EACH ROW
EXECUTE FUNCTION public.auto_open_on_insert_assignment();

-- 2) Backfill: conversas pendentes que já têm responsável passam para 'open'
UPDATE public.chat_conversations
SET status = 'open',
    updated_at = now()
WHERE status = 'pending'
  AND assigned_to IS NOT NULL
  AND TRIM(assigned_to) <> '';