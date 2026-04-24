-- 1. Caso específico relatado
UPDATE public.chat_conversations
SET queue_id = 'f81446ce-e830-47cc-8a5d-4f08b0984614',
    channel = 'whatsapp_waba'
WHERE id = '1ec8f2ae-9498-4e68-a676-e98d73270f28';

-- 2. WABA: realinhar conversas cujo contato tem channel_source apontando para fila WABA
UPDATE public.chat_conversations conv
SET queue_id = sub.correct_queue_id,
    channel = 'whatsapp_waba'
FROM (
  SELECT cc.id AS contact_id, q.id AS correct_queue_id
  FROM public.chat_contacts cc
  JOIN public.queues q
    ON q.id::text = cc.channel_source
   AND q.channel_type = 'waba'
   AND q.is_deleted = false
  WHERE cc.channel_type = 'whatsapp_waba'
) sub
WHERE conv.contact_id = sub.contact_id
  AND conv.status IN ('pending','open')
  AND (
    conv.queue_id IS NULL
    OR conv.queue_id <> sub.correct_queue_id
  )
  AND COALESCE(
    (SELECT channel_type FROM public.queues WHERE id = conv.queue_id),
    ''
  ) <> 'waba';

-- 3. UaZapi: idem
UPDATE public.chat_conversations conv
SET queue_id = sub.correct_queue_id,
    channel = 'whatsapp_uazapi'
FROM (
  SELECT cc.id AS contact_id, q.id AS correct_queue_id
  FROM public.chat_contacts cc
  JOIN public.queues q
    ON q.id::text = cc.channel_source
   AND q.channel_type = 'uazapi'
   AND q.is_deleted = false
  WHERE cc.channel_type = 'whatsapp_uazapi'
) sub
WHERE conv.contact_id = sub.contact_id
  AND conv.status IN ('pending','open')
  AND (
    conv.queue_id IS NULL
    OR conv.queue_id <> sub.correct_queue_id
  )
  AND COALESCE(
    (SELECT channel_type FROM public.queues WHERE id = conv.queue_id),
    ''
  ) <> 'uazapi';