-- Add note_type column to chat_messages for typed internal notes
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS note_type text DEFAULT 'info';

-- Backfill existing internal notes
UPDATE public.chat_messages
SET note_type = 'info'
WHERE internal_note = true AND note_type IS NULL;

-- Validation trigger (avoid CHECK constraint per project guidelines)
CREATE OR REPLACE FUNCTION public.validate_chat_message_note_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.note_type IS NOT NULL AND NEW.note_type NOT IN ('info', 'question', 'urgent') THEN
    RAISE EXCEPTION 'Invalid note_type: %, expected info|question|urgent', NEW.note_type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_chat_message_note_type_trigger ON public.chat_messages;
CREATE TRIGGER validate_chat_message_note_type_trigger
BEFORE INSERT OR UPDATE ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.validate_chat_message_note_type();