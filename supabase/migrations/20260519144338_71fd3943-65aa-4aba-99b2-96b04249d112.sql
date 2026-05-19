
CREATE OR REPLACE FUNCTION public.merge_duplicate_chat_contacts(p_limit int DEFAULT 100)
RETURNS int
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_canonical uuid;
  v_dup uuid;
  conv RECORD;
  v_target_conv uuid;
  v_processed int := 0;
BEGIN
  FOR r IN
    SELECT client_id, remote_jid, channel_source,
           ARRAY_AGG(id ORDER BY (length(phone) = 13 AND substr(phone,5,1) = '9') DESC,
                                  created_at ASC) AS ids
    FROM public.chat_contacts
    WHERE remote_jid IS NOT NULL
      AND COALESCE(is_group,false) = false
    GROUP BY client_id, remote_jid, channel_source
    HAVING COUNT(*) > 1
    LIMIT p_limit
  LOOP
    v_canonical := r.ids[1];
    FOREACH v_dup IN ARRAY r.ids[2:array_length(r.ids,1)] LOOP

      FOR conv IN
        SELECT id, client_id, queue_id, channel
          FROM public.chat_conversations
         WHERE contact_id = v_dup
      LOOP
        SELECT id INTO v_target_conv
          FROM public.chat_conversations
         WHERE contact_id = v_canonical
           AND client_id IS NOT DISTINCT FROM conv.client_id
           AND queue_id  IS NOT DISTINCT FROM conv.queue_id
           AND channel   IS NOT DISTINCT FROM conv.channel
         ORDER BY created_at ASC LIMIT 1;

        IF v_target_conv IS NOT NULL THEN
          UPDATE public.chat_messages SET conversation_id = v_target_conv WHERE conversation_id = conv.id;
          UPDATE public.chat_conversation_summaries SET conversation_id = v_target_conv WHERE conversation_id = conv.id;
          DELETE FROM public.chat_conversations WHERE id = conv.id;
        ELSE
          UPDATE public.chat_conversations SET contact_id = v_canonical WHERE id = conv.id;
        END IF;
      END LOOP;

      UPDATE public.chat_messages             SET contact_id = v_canonical WHERE contact_id = v_dup;
      UPDATE public.chat_bot_flow_runs        SET contact_id = v_canonical WHERE contact_id = v_dup;
      UPDATE public.chat_call_logs            SET contact_id = v_canonical WHERE contact_id = v_dup;
      UPDATE public.chat_campaign_recipients  SET contact_id = v_canonical WHERE contact_id = v_dup;
      UPDATE public.chat_conversation_summaries SET contact_id = v_canonical WHERE contact_id = v_dup;
      UPDATE public.chat_crm_links            SET contact_id = v_canonical WHERE contact_id = v_dup;
      UPDATE public.chat_csat_responses       SET contact_id = v_canonical WHERE contact_id = v_dup;
      UPDATE public.chat_lgpd_requests        SET contact_id = v_canonical WHERE contact_id = v_dup;
      UPDATE public.chat_scheduled_messages   SET contact_id = v_canonical WHERE contact_id = v_dup;
      UPDATE public.webchat_sessions          SET contact_id = v_canonical WHERE contact_id = v_dup;
      UPDATE public.webhook_logs              SET contact_id = v_canonical WHERE contact_id = v_dup;

      DELETE FROM public.chat_contacts WHERE id = v_dup;
    END LOOP;
    v_processed := v_processed + 1;
  END LOOP;
  RETURN v_processed;
END $$;
