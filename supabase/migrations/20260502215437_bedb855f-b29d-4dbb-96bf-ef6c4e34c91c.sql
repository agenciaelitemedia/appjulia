CREATE OR REPLACE FUNCTION public.sync_contact_channel_source_from_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel_type text;
BEGIN
  IF NEW.queue_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('pending', 'open') THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.queue_id IS NOT DISTINCT FROM NEW.queue_id
     AND OLD.status   IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT CASE WHEN q.channel_type = 'waba' THEN 'whatsapp_waba'
              WHEN q.channel_type = 'uazapi' THEN 'whatsapp_uazapi'
              ELSE NULL END
    INTO v_channel_type
    FROM public.queues q
   WHERE q.id = NEW.queue_id;

  UPDATE public.chat_contacts
     SET channel_source = NEW.queue_id::text,
         channel_type   = COALESCE(v_channel_type, channel_type),
         updated_at     = now()
   WHERE id = NEW.contact_id
     AND (channel_source IS DISTINCT FROM NEW.queue_id::text);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contact_channel_source ON public.chat_conversations;
CREATE TRIGGER trg_sync_contact_channel_source
AFTER INSERT OR UPDATE OF queue_id, status ON public.chat_conversations
FOR EACH ROW
EXECUTE FUNCTION public.sync_contact_channel_source_from_conversation();

WITH latest_active AS (
  SELECT DISTINCT ON (contact_id)
         contact_id, queue_id
    FROM public.chat_conversations
   WHERE status IN ('pending','open') AND queue_id IS NOT NULL
   ORDER BY contact_id, updated_at DESC
)
UPDATE public.chat_contacts c
   SET channel_source = la.queue_id::text,
       channel_type   = CASE WHEN q.channel_type = 'waba' THEN 'whatsapp_waba'
                             WHEN q.channel_type = 'uazapi' THEN 'whatsapp_uazapi'
                             ELSE c.channel_type END,
       updated_at     = now()
  FROM latest_active la
  JOIN public.queues q ON q.id = la.queue_id
 WHERE c.id = la.contact_id
   AND c.channel_source IS DISTINCT FROM la.queue_id::text;