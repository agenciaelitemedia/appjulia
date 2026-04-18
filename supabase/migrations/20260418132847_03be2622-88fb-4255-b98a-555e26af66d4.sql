WITH waba_queues AS (
  SELECT id AS queue_id, client_id::text AS queue_client_id, waba_number_id
  FROM queues
  WHERE channel_type = 'waba' AND waba_number_id IS NOT NULL AND is_active = true AND is_deleted = false
),
moved_contacts AS (
  UPDATE chat_contacts c
  SET channel_source = wq.queue_id::text,
      client_id = wq.queue_client_id,
      channel_type = 'whatsapp_waba'
  FROM waba_queues wq
  WHERE c.channel_type = 'whatsapp_waba'
    AND c.channel_source = wq.waba_number_id
  RETURNING c.id, wq.queue_id, wq.queue_client_id
)
UPDATE chat_conversations conv
SET queue_id = mc.queue_id,
    client_id = mc.queue_client_id,
    channel = 'whatsapp_waba'
FROM moved_contacts mc
WHERE conv.contact_id = mc.id
  AND (conv.queue_id IS DISTINCT FROM mc.queue_id OR conv.client_id IS DISTINCT FROM mc.queue_client_id);