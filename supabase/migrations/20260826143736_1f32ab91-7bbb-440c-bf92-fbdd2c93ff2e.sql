CREATE OR REPLACE FUNCTION public.update_conversation_message_tracking()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_prev_snooze timestamptz;
BEGIN
  IF NEW.conversation_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.from_me = false THEN
    SELECT snoozed_until INTO v_prev_snooze
    FROM chat_conversations
    WHERE id = NEW.conversation_id;
  END IF;

  UPDATE chat_conversations
  SET
    last_customer_message_at = CASE
      WHEN NEW.from_me = false THEN NEW.created_at
      ELSE last_customer_message_at
    END,
    last_message_from_me = NEW.from_me,
    snoozed_until = CASE WHEN NEW.from_me = false THEN NULL ELSE snoozed_until END,
    snoozed_by = CASE WHEN NEW.from_me = false THEN NULL ELSE snoozed_by END,
    snooze_reason = CASE WHEN NEW.from_me = false THEN NULL ELSE snooze_reason END,
    updated_at = CASE
      WHEN NEW.from_me = false AND snoozed_until IS NOT NULL THEN now()
      ELSE updated_at
    END
  WHERE id = NEW.conversation_id;

  IF NEW.from_me = false AND v_prev_snooze IS NOT NULL THEN
    INSERT INTO chat_conversation_history (conversation_id, action, actor_name, from_value, to_value, notes)
    VALUES (
      NEW.conversation_id,
      'snooze_cancelled',
      'Sistema',
      v_prev_snooze::text,
      NULL,
      'Retorno agendado cancelado automaticamente — o cliente respondeu'
    );
  END IF;

  RETURN NEW;
END;
$function$;