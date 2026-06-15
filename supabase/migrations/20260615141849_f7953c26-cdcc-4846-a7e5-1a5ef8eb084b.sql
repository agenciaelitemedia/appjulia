
CREATE OR REPLACE FUNCTION public.inherit_open_ticket_on_new_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_open_statuses constant text[] := ARRAY['open','pending','in_progress','waiting_customer'];
  v_ticket record;
BEGIN
  IF NEW.contact_id IS NULL OR NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Encontra o ticket aberto mais recente do mesmo contato/cliente
  SELECT id, number, protocol
    INTO v_ticket
    FROM public.support_tickets
   WHERE contact_id = NEW.contact_id
     AND client_id  = NEW.client_id
     AND status = ANY (v_open_statuses)
     AND (conversation_id IS NULL OR conversation_id <> NEW.id)
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Reaponta o ticket para a nova conversa. O trigger
  -- sync_conversation_active_ticket (em support_tickets) cuida de:
  --   * limpar active_ticket_id da conversa antiga
  --   * preencher active_ticket_id/number/protocol na nova
  UPDATE public.support_tickets
     SET conversation_id = NEW.id,
         updated_at = now()
   WHERE id = v_ticket.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inherit_open_ticket_on_new_conversation ON public.chat_conversations;
CREATE TRIGGER trg_inherit_open_ticket_on_new_conversation
AFTER INSERT ON public.chat_conversations
FOR EACH ROW
EXECUTE FUNCTION public.inherit_open_ticket_on_new_conversation();
