-- Índices de expressão "inline" (funções imutáveis internas), para que o
-- planejador consiga casar a expressão da consulta com o índice.
DROP INDEX IF EXISTS public.idx_chat_messages_msgid_suffix;
DROP INDEX IF EXISTS public.idx_chat_messages_extid_suffix;

CREATE INDEX IF NOT EXISTS idx_chat_messages_msgid_tail
  ON public.chat_messages ((reverse(split_part(reverse(message_id), ':', 1))))
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_extid_tail
  ON public.chat_messages ((reverse(split_part(reverse(external_id), ':', 1))))
  WHERE external_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.chat_resolve_message_ids(p_ids text[])
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id FROM public.chat_messages m
   WHERE m.message_id = ANY(p_ids) OR m.external_id = ANY(p_ids)
  UNION
  SELECT m.id FROM public.chat_messages m
   WHERE m.message_id IS NOT NULL
     AND reverse(split_part(reverse(m.message_id), ':', 1)) = ANY(p_ids)
  UNION
  SELECT m.id FROM public.chat_messages m
   WHERE m.external_id IS NOT NULL
     AND reverse(split_part(reverse(m.external_id), ':', 1)) = ANY(p_ids)
$$;

REVOKE ALL ON FUNCTION public.chat_resolve_message_ids(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_resolve_message_ids(text[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_resolve_message_ids(text[]) TO service_role;

DROP FUNCTION IF EXISTS public.chat_msg_id_suffix(text);