CREATE OR REPLACE FUNCTION public.chat_messages_compact_raw_payload(p_limit integer DEFAULT 20000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH alvo AS (
    SELECT id FROM public.chat_messages
    WHERE type = 'text' AND raw_payload IS NOT NULL
      AND timestamp < now() - interval '30 days'
    LIMIT p_limit
  ), upd AS (
    UPDATE public.chat_messages m SET raw_payload = NULL
    FROM alvo WHERE m.id = alvo.id
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_messages_compact_raw_payload(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_messages_compact_raw_payload(integer) FROM anon;
REVOKE ALL ON FUNCTION public.chat_messages_compact_raw_payload(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.chat_messages_compact_raw_payload(integer) TO service_role;

SELECT cron.schedule(
  'chat-messages-compact-raw-payload',
  '35 * * * *',
  $$SELECT public.chat_messages_compact_raw_payload(20000);$$
);