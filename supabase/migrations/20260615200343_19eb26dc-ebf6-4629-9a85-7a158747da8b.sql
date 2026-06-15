-- Fix broken trigger: support_tickets uses requester_client_id, not client_id
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

  SELECT id, number, protocol
    INTO v_ticket
    FROM public.support_tickets
   WHERE contact_id = NEW.contact_id
     AND requester_client_id = NEW.client_id
     AND status = ANY (v_open_statuses)
     AND (conversation_id IS NULL OR conversation_id <> NEW.id)
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.support_tickets
     SET conversation_id = NEW.id,
         updated_at = now()
   WHERE id = v_ticket.id;

  RETURN NEW;
END;
$$;

-- Backfill orphan messages: create a conversation for each distinct
-- (contact_id, client_id, channel_type) and link the orphans to it.
DO $$
DECLARE
  r record;
  v_queue_id uuid;
  v_conv_id uuid;
  v_existing_id uuid;
BEGIN
  FOR r IN
    SELECT m.contact_id, m.client_id, m.channel_type, COUNT(*) AS cnt,
           MIN(m.created_at) AS first_at, MAX(m.created_at) AS last_at
      FROM public.chat_messages m
     WHERE m.conversation_id IS NULL
       AND m.created_at >= '2026-06-15 14:00:00+00'
     GROUP BY m.contact_id, m.client_id, m.channel_type
  LOOP
    -- Derive queue_id from contact.channel_source (uuid string)
    SELECT NULLIF(c.channel_source, '')::uuid
      INTO v_queue_id
      FROM public.chat_contacts c
     WHERE c.id = r.contact_id;

    -- Look for an existing active conversation first
    SELECT id INTO v_existing_id
      FROM public.chat_conversations
     WHERE contact_id = r.contact_id
       AND client_id  = r.client_id
       AND channel    = r.channel_type
       AND status IN ('pending','open')
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      v_conv_id := v_existing_id;
    ELSE
      INSERT INTO public.chat_conversations (
        contact_id, client_id, queue_id, channel, status, priority, protocol, metadata
      ) VALUES (
        r.contact_id, r.client_id, v_queue_id, r.channel_type,
        'pending', 'normal', '',
        jsonb_build_object('recovered_orphan', true, 'orphan_count', r.cnt)
      )
      RETURNING id INTO v_conv_id;

      INSERT INTO public.chat_conversation_history (conversation_id, action, actor_name, notes)
      VALUES (v_conv_id, 'recovered', 'system',
              format('Recuperação automática: %s mensagens órfãs reanexadas', r.cnt));
    END IF;

    UPDATE public.chat_messages
       SET conversation_id = v_conv_id
     WHERE contact_id = r.contact_id
       AND client_id  = r.client_id
       AND channel_type = r.channel_type
       AND conversation_id IS NULL
       AND created_at >= '2026-06-15 14:00:00+00';
  END LOOP;
END $$;