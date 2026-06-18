
-- ============ Passada A — via a própria conversa =============

UPDATE public.chat_conversation_history h
SET user_id = c.assigned_user_id
FROM public.chat_conversations c
WHERE h.conversation_id = c.id
  AND h.user_id IS NULL
  AND h.actor_name IS NOT NULL
  AND h.actor_name NOT ILIKE 'Sistema%'
  AND lower(btrim(h.actor_name)) <> 'system'
  AND c.assigned_user_id IS NOT NULL
  AND c.assigned_to IS NOT NULL
  AND lower(btrim(h.actor_name)) = lower(btrim(c.assigned_to))
  AND h.action IN (
    'resolved','closed','reopened','assigned',
    'tag_added','tag_removed','note_added','snoozed',
    'priority_changed','manual_closed_for_new_conversation',
    'returned_to_queue'
  );

UPDATE public.chat_conversation_history h
SET to_user_id = c.assigned_user_id
FROM public.chat_conversations c
WHERE h.conversation_id = c.id
  AND h.to_user_id IS NULL
  AND h.action = 'assigned'
  AND h.to_value IS NOT NULL
  AND c.assigned_user_id IS NOT NULL
  AND c.assigned_to IS NOT NULL
  AND lower(btrim(h.to_value)) = lower(btrim(c.assigned_to));

UPDATE public.chat_conversation_history h
SET from_user_id = c.assigned_user_id
FROM public.chat_conversations c
WHERE h.conversation_id = c.id
  AND h.from_user_id IS NULL
  AND h.action IN ('returned_to_queue','auto_returned')
  AND c.assigned_user_id IS NOT NULL
  AND c.assigned_to IS NOT NULL
  AND lower(btrim(coalesce(h.from_value, h.actor_name))) = lower(btrim(c.assigned_to));

-- ============ Passada B — fallback (mapa global por client_id + nome) =============

CREATE TEMP TABLE _name_map ON COMMIT DROP AS
WITH src AS (
  SELECT client_id::text AS client_id,
         lower(btrim(assigned_to)) AS nkey,
         assigned_user_id::bigint  AS user_id
    FROM public.chat_conversations
   WHERE assigned_to IS NOT NULL
     AND btrim(assigned_to) <> ''
     AND assigned_user_id IS NOT NULL
  UNION
  SELECT client_id::text,
         lower(btrim(user_name)),
         user_id::bigint
    FROM public.user_activity_log
   WHERE user_name IS NOT NULL
     AND btrim(user_name) <> ''
     AND user_id IS NOT NULL
     AND client_id IS NOT NULL
)
SELECT client_id, nkey, MIN(user_id) AS user_id
  FROM src
 GROUP BY client_id, nkey
HAVING COUNT(DISTINCT user_id) = 1;

CREATE INDEX ON _name_map (client_id, nkey);

UPDATE public.chat_conversation_history h
SET user_id = m.user_id
FROM public.chat_conversations c, _name_map m
WHERE h.conversation_id = c.id
  AND m.client_id = c.client_id::text
  AND m.nkey      = lower(btrim(h.actor_name))
  AND h.user_id IS NULL
  AND h.actor_name IS NOT NULL
  AND h.actor_name NOT ILIKE 'Sistema%'
  AND lower(btrim(h.actor_name)) <> 'system'
  AND h.action IN (
    'resolved','closed','reopened','assigned',
    'tag_added','tag_removed','note_added','snoozed',
    'priority_changed','manual_closed_for_new_conversation',
    'returned_to_queue','bulk_closed'
  );

UPDATE public.chat_conversation_history h
SET to_user_id = m.user_id
FROM public.chat_conversations c, _name_map m
WHERE h.conversation_id = c.id
  AND m.client_id = c.client_id::text
  AND m.nkey      = lower(btrim(h.to_value))
  AND h.to_user_id IS NULL
  AND h.action = 'assigned'
  AND h.to_value IS NOT NULL;

UPDATE public.chat_conversation_history h
SET from_user_id = m.user_id
FROM public.chat_conversations c, _name_map m
WHERE h.conversation_id = c.id
  AND m.client_id = c.client_id::text
  AND m.nkey      = lower(btrim(coalesce(h.from_value, h.actor_name)))
  AND h.from_user_id IS NULL
  AND h.action IN ('returned_to_queue','auto_returned');

SELECT public.refresh_team_performance_mvs();
