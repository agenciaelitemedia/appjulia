UPDATE public.chat_agent_capacity c
SET current_load = COALESCE(l.load, 0),
    updated_at = now()
FROM (
  SELECT cap.id, x.load
  FROM public.chat_agent_capacity cap
  LEFT JOIN LATERAL (
    SELECT SUM(q.load)::int AS load
    FROM public.chat_agent_load_by_queue(cap.client_id) q
    WHERE q.agent_identifier = cap.agent_identifier
  ) x ON true
) l
WHERE c.id = l.id;