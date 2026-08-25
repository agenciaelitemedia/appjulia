-- Reduz superfície: a dedup é usada apenas por Edge Functions (service_role)
REVOKE EXECUTE ON FUNCTION public.chat_resolve_message_ids(text[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.chat_resolve_message_ids(text[]) FROM anon;