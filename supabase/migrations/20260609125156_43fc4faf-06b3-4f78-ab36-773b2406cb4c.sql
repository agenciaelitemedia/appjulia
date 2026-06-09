-- Add active ticket link column to chat_conversations
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS active_ticket_id uuid NULL,
  ADD COLUMN IF NOT EXISTS active_ticket_number bigint NULL;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_active_ticket
  ON public.chat_conversations (active_ticket_id)
  WHERE active_ticket_id IS NOT NULL;

-- Trigger function: keep chat_conversations.active_ticket_id in sync with support_tickets
CREATE OR REPLACE FUNCTION public.sync_conversation_active_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open_statuses constant text[] := ARRAY['open','pending','in_progress','waiting_customer'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.conversation_id IS NOT NULL THEN
      UPDATE public.chat_conversations
         SET active_ticket_id = NULL,
             active_ticket_number = NULL
       WHERE id = OLD.conversation_id
         AND active_ticket_id = OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  -- On UPDATE, if conversation_id changed, clear the OLD conversation's link first
  IF TG_OP = 'UPDATE'
     AND OLD.conversation_id IS DISTINCT FROM NEW.conversation_id
     AND OLD.conversation_id IS NOT NULL THEN
    UPDATE public.chat_conversations
       SET active_ticket_id = NULL,
           active_ticket_number = NULL
     WHERE id = OLD.conversation_id
       AND active_ticket_id = NEW.id;
  END IF;

  IF NEW.conversation_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = ANY (v_open_statuses) THEN
    -- Set the link only if conversation has no active ticket OR already points to this one
    UPDATE public.chat_conversations
       SET active_ticket_id = NEW.id,
           active_ticket_number = NEW.number
     WHERE id = NEW.conversation_id
       AND (active_ticket_id IS NULL OR active_ticket_id = NEW.id);
  ELSE
    -- Ticket became resolved/closed → clear link if it pointed to this ticket
    UPDATE public.chat_conversations
       SET active_ticket_id = NULL,
           active_ticket_number = NULL
     WHERE id = NEW.conversation_id
       AND active_ticket_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_tickets_link_conversation ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_link_conversation
AFTER INSERT OR UPDATE OF status, conversation_id, number OR DELETE
ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.sync_conversation_active_ticket();

-- Backfill: for each conversation, link the most recent OPEN ticket
WITH latest_open AS (
  SELECT DISTINCT ON (conversation_id)
         conversation_id, id, number
  FROM public.support_tickets
  WHERE conversation_id IS NOT NULL
    AND status IN ('open','pending','in_progress','waiting_customer')
  ORDER BY conversation_id, created_at DESC
)
UPDATE public.chat_conversations c
   SET active_ticket_id = lo.id,
       active_ticket_number = lo.number
  FROM latest_open lo
 WHERE c.id = lo.conversation_id
   AND (c.active_ticket_id IS DISTINCT FROM lo.id);