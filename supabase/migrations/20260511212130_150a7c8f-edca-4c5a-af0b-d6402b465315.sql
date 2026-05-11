CREATE OR REPLACE FUNCTION public.increment_contact_unread(
  p_contact_id uuid,
  p_preview text DEFAULT NULL,
  p_last_at timestamptz DEFAULT now()
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.chat_contacts
  SET unread_count = COALESCE(unread_count, 0) + 1,
      last_message_text = COALESCE(p_preview, last_message_text),
      last_message_at = COALESCE(p_last_at, last_message_at),
      updated_at = now()
  WHERE id = p_contact_id;
$$;