-- Recovery: move tickets abertos cuja fila divergiu do channel_source do contato
-- (resultado dos webhooks/history sem filtro de queue_id). Move para a fila do channel_source.
UPDATE chat_conversations cc
SET queue_id = ct.channel_source::uuid,
    channel  = COALESCE(
      CASE q2.channel_type
        WHEN 'uazapi' THEN 'whatsapp_uazapi'
        WHEN 'waba'   THEN 'whatsapp_waba'
        WHEN 'instagram' THEN 'instagram'
        WHEN 'webchat'   THEN 'webchat'
        ELSE cc.channel
      END,
      cc.channel
    ),
    updated_at = now()
FROM chat_contacts ct
JOIN queues q2 ON q2.id = ct.channel_source::uuid
WHERE cc.contact_id = ct.id
  AND cc.status IN ('pending','open')
  AND ct.channel_source IS NOT NULL
  AND ct.channel_source <> cc.queue_id::text
  AND q2.is_active = true
  AND q2.is_deleted = false;
