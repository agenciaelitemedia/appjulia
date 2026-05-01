
-- 1) Para cada grupo de conversas ativas duplicadas, escolhe um "keeper":
--    a conversa com mais mensagens (desempate: mais recente).
--    As demais são "losers" e terão suas referências apontadas para o keeper.
WITH grouped AS (
  SELECT
    c.id,
    c.contact_id, c.client_id, c.queue_id, c.channel,
    (SELECT COUNT(*) FROM public.chat_messages m WHERE m.conversation_id = c.id) AS msg_count,
    c.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY c.contact_id, c.client_id, c.queue_id, c.channel
      ORDER BY (SELECT COUNT(*) FROM public.chat_messages m WHERE m.conversation_id = c.id) DESC,
               c.created_at DESC
    ) AS rn
  FROM public.chat_conversations c
  WHERE c.status IN ('pending','open')
),
keepers AS (
  SELECT contact_id, client_id, queue_id, channel, id AS keeper_id
  FROM grouped
  WHERE rn = 1
),
losers AS (
  SELECT g.id AS loser_id, k.keeper_id
  FROM grouped g
  JOIN keepers k
    ON k.contact_id = g.contact_id
   AND k.client_id  = g.client_id
   AND ((k.queue_id IS NULL AND g.queue_id IS NULL) OR k.queue_id = g.queue_id)
   AND k.channel    = g.channel
  WHERE g.rn > 1
)
-- 2) Redireciona mensagens dos losers para o keeper
UPDATE public.chat_messages m
SET conversation_id = l.keeper_id
FROM losers l
WHERE m.conversation_id = l.loser_id;

-- 3) Redireciona histórico
WITH grouped AS (
  SELECT
    c.id, c.contact_id, c.client_id, c.queue_id, c.channel,
    ROW_NUMBER() OVER (
      PARTITION BY c.contact_id, c.client_id, c.queue_id, c.channel
      ORDER BY (SELECT COUNT(*) FROM public.chat_messages m WHERE m.conversation_id = c.id) DESC,
               c.created_at DESC
    ) AS rn
  FROM public.chat_conversations c
  WHERE c.status IN ('pending','open')
),
keepers AS (
  SELECT contact_id, client_id, queue_id, channel, id AS keeper_id
  FROM grouped WHERE rn = 1
),
losers AS (
  SELECT g.id AS loser_id, k.keeper_id
  FROM grouped g
  JOIN keepers k
    ON k.contact_id = g.contact_id
   AND k.client_id  = g.client_id
   AND ((k.queue_id IS NULL AND g.queue_id IS NULL) OR k.queue_id = g.queue_id)
   AND k.channel    = g.channel
  WHERE g.rn > 1
)
UPDATE public.chat_conversation_history h
SET conversation_id = l.keeper_id
FROM losers l
WHERE h.conversation_id = l.loser_id;

-- 4) Apaga os losers (já não têm dependências)
WITH grouped AS (
  SELECT
    c.id, c.contact_id, c.client_id, c.queue_id, c.channel,
    ROW_NUMBER() OVER (
      PARTITION BY c.contact_id, c.client_id, c.queue_id, c.channel
      ORDER BY (SELECT COUNT(*) FROM public.chat_messages m WHERE m.conversation_id = c.id) DESC,
               c.created_at DESC
    ) AS rn
  FROM public.chat_conversations c
  WHERE c.status IN ('pending','open')
),
losers AS (
  SELECT id FROM grouped WHERE rn > 1
)
DELETE FROM public.chat_conversations
WHERE id IN (SELECT id FROM losers);

-- 5) Índice único parcial: garante uma única conversa ativa por (contact, client, queue, channel)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_conversation_per_contact_queue_channel
  ON public.chat_conversations (contact_id, client_id, queue_id, channel)
  WHERE status IN ('pending', 'open') AND queue_id IS NOT NULL;

-- 5b) E uma variante para conversas sem queue_id (caso raro)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_conversation_per_contact_channel_no_queue
  ON public.chat_conversations (contact_id, client_id, channel)
  WHERE status IN ('pending', 'open') AND queue_id IS NULL;
