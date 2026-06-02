CREATE OR REPLACE FUNCTION public.auto_resolve_prior_queue_conversations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prior record;
BEGIN
  -- Apenas quando a conversa atual está ativa (pending/open) e tem fila/contato/canal
  IF NEW.status NOT IN ('pending', 'open') THEN
    RETURN NEW;
  END IF;
  IF NEW.contact_id IS NULL OR NEW.queue_id IS NULL OR NEW.channel IS NULL THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE, só dispara se houve mudança relevante (status virou ativa OU a fila mudou)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = NEW.status
       AND OLD.queue_id IS NOT DISTINCT FROM NEW.queue_id
       AND OLD.contact_id IS NOT DISTINCT FROM NEW.contact_id THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Evita recursão
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  FOR v_prior IN
    SELECT id, queue_id, assigned_to
    FROM public.chat_conversations
    WHERE contact_id = NEW.contact_id
      AND client_id  = NEW.client_id
      AND channel    = NEW.channel
      AND id        <> NEW.id
      AND status IN ('pending', 'open')
      AND queue_id IS DISTINCT FROM NEW.queue_id
  LOOP
    UPDATE public.chat_conversations
       SET status      = 'resolved',
           resolved_at = now(),
           close_note  = COALESCE(close_note, '') || ' [auto] Resolvida: contato passou a ser atendido em outra fila',
           updated_at  = now()
     WHERE id = v_prior.id;

    INSERT INTO public.chat_conversation_history (conversation_id, action, actor_name, notes)
    VALUES (
      v_prior.id,
      'auto_resolved_queue_switch',
      'system',
      'Resolvida automaticamente: contato passou a ser atendido na fila ' || NEW.queue_id::text
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_resolve_prior_queue_conversations ON public.chat_conversations;

CREATE TRIGGER trg_auto_resolve_prior_queue_conversations
AFTER INSERT OR UPDATE OF status, queue_id, contact_id ON public.chat_conversations
FOR EACH ROW
EXECUTE FUNCTION public.auto_resolve_prior_queue_conversations();