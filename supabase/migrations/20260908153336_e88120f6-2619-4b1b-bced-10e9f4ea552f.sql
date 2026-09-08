CREATE OR REPLACE FUNCTION public.chat_enforce_owner_on_open()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'open' AND COALESCE(TRIM(NEW.assigned_to), '') = '' THEN
    NEW.status := 'pending';
    NEW.assigned_user_id := NULL;
    NEW.assigned_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_chat_enforce_owner_on_open ON public.chat_conversations;
CREATE TRIGGER trg_chat_enforce_owner_on_open
BEFORE INSERT OR UPDATE ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.chat_enforce_owner_on_open();

UPDATE public.chat_conversations
   SET status = 'pending',
       assigned_user_id = NULL,
       assigned_at = NULL,
       updated_at = now()
 WHERE status = 'open'
   AND COALESCE(TRIM(assigned_to), '') = '';