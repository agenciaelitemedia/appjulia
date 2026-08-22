-- Índices de apoio (aditivos)
CREATE INDEX IF NOT EXISTS idx_mvp_chat_conv_client_contact_updated
  ON public.chat_conversations (client_id, contact_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mvp_chat_contacts_client_lastmsg
  ON public.chat_contacts (client_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_mvp_chat_conv_tags_conv
  ON public.chat_conversation_tags (conversation_id);
CREATE INDEX IF NOT EXISTS idx_mvp_crm_deals_client_status
  ON public.crm_deals (client_id, status);

CREATE OR REPLACE FUNCTION public.mvp_chat_list_feed(
  p_client_id text,
  p_queue_ids uuid[] DEFAULT NULL,
  p_status text DEFAULT NULL,          -- 'pending' | 'open' | 'resolved' | 'closed' | 'resolved_closed' | NULL
  p_tab text DEFAULT NULL,             -- 'individual' | 'groups' | NULL
  p_owner text DEFAULT NULL,           -- exact assigned_to
  p_unassigned boolean DEFAULT NULL,   -- true => assigned_to IS NULL
  p_search text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_tag_ids uuid[] DEFAULT NULL,
  p_priority text DEFAULT NULL,
  p_has_ticket boolean DEFAULT NULL,
  p_has_crm_builder boolean DEFAULT NULL,
  p_sort text DEFAULT 'recent',        -- 'recent' | 'oldest' | 'unread'
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH leader AS (
  SELECT DISTINCT ON (c.contact_id)
         c.id, c.contact_id, c.client_id, c.cod_agent, c.queue_id, c.channel,
         c.status, c.protocol, c.assigned_to, c.assigned_user_id, c.priority,
         c.opened_at, c.first_response_at, c.resolved_at, c.closed_at,
         c.snoozed_until, c.snooze_reason,
         c.last_customer_message_at, c.last_message_from_me,
         c.active_ticket_id, c.active_ticket_number, c.active_ticket_protocol,
         c.created_at, c.updated_at
    FROM public.chat_conversations c
   WHERE c.client_id = p_client_id
   ORDER BY c.contact_id, c.updated_at DESC NULLS LAST, c.opened_at DESC NULLS LAST, c.created_at DESC
),
builder AS (
  SELECT DISTINCT ON (link_key, link_kind)
         link_kind, link_key, board_name, board_color, pipeline_name, pipeline_color, d_updated
    FROM (
      SELECT 'conv'::text AS link_kind,
             (d.custom_fields->'links'->'chat'->>'conversation_id') AS link_key,
             b.name AS board_name, b.color AS board_color,
             p.name AS pipeline_name, p.color AS pipeline_color,
             d.updated_at AS d_updated
        FROM public.crm_deals d
        LEFT JOIN public.crm_boards b ON b.id = d.board_id
        LEFT JOIN public.crm_pipelines p ON p.id = d.pipeline_id
       WHERE d.client_id = p_client_id
         AND COALESCE(d.status, '') <> 'archived'
         AND (d.custom_fields->'links'->'chat'->>'conversation_id') IS NOT NULL
      UNION ALL
      SELECT 'contact'::text,
             (d.custom_fields->'links'->'chat'->>'contact_id'),
             b.name, b.color, p.name, p.color, d.updated_at
        FROM public.crm_deals d
        LEFT JOIN public.crm_boards b ON b.id = d.board_id
        LEFT JOIN public.crm_pipelines p ON p.id = d.pipeline_id
       WHERE d.client_id = p_client_id
         AND COALESCE(d.status, '') <> 'archived'
         AND (d.custom_fields->'links'->'chat'->>'contact_id') IS NOT NULL
    ) u
   ORDER BY link_key, link_kind, d_updated DESC NULLS LAST
),
base AS (
  SELECT
    ct.id                AS contact_id,
    ct.name              AS contact_name,
    ct.phone             AS phone,
    ct.avatar            AS avatar,
    ct.avatar_storage_path,
    ct.is_group,
    ct.unread_count,
    ct.last_message_at,
    ct.last_message_text,
    ct.channel_source,
    ct.channel_type,
    ct.lead_full_name,
    l.id                 AS conversation_id,
    l.queue_id,
    q.name               AS queue_name,
    q.is_active          AS queue_is_active,
    l.channel,
    CASE WHEN l.status = 'pending' AND l.assigned_to IS NOT NULL AND l.assigned_to <> ''
         THEN 'open' ELSE l.status END AS status,
    l.protocol,
    l.assigned_to,
    l.assigned_user_id,
    l.priority,
    l.opened_at,
    l.first_response_at,
    l.resolved_at,
    l.closed_at,
    l.snoozed_until,
    l.snooze_reason,
    l.last_customer_message_at,
    l.last_message_from_me,
    l.updated_at         AS conversation_updated_at,
    l.active_ticket_id,
    l.active_ticket_number,
    l.active_ticket_protocol,
    t.status             AS ticket_status,
    t.priority           AS ticket_priority,
    t.subject            AS ticket_subject,
    qal.cod_agent        AS queue_cod_agent,
    COALESCE(bc.board_name, bk.board_name)         AS crm_board_name,
    COALESCE(bc.board_color, bk.board_color)       AS crm_board_color,
    COALESCE(bc.pipeline_name, bk.pipeline_name)   AS crm_pipeline_name,
    COALESCE(bc.pipeline_color, bk.pipeline_color) AS crm_pipeline_color,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', tg.id, 'name', tg.name, 'color', tg.color))
        FROM public.chat_conversation_tags cvt
        JOIN public.chat_tags tg ON tg.id = cvt.tag_id
       WHERE cvt.conversation_id = l.id
    ), '[]'::jsonb) AS tags,
    (
      SELECT array_agg(cvt2.tag_id) FROM public.chat_conversation_tags cvt2
       WHERE cvt2.conversation_id = l.id
    ) AS tag_ids
  FROM leader l
  JOIN public.chat_contacts ct ON ct.id = l.contact_id
  LEFT JOIN public.queues q ON q.id = l.queue_id
  LEFT JOIN public.support_tickets t ON t.id = l.active_ticket_id
  LEFT JOIN LATERAL (
    SELECT k.cod_agent FROM public.queue_agent_links k
     WHERE k.queue_id = l.queue_id
     ORDER BY k.is_primary DESC NULLS LAST, k.created_at ASC
     LIMIT 1
  ) qal ON true
  LEFT JOIN builder bc ON bc.link_kind = 'conv' AND bc.link_key = l.id::text
  LEFT JOIN builder bk ON bk.link_kind = 'contact' AND bk.link_key = l.contact_id::text
  WHERE ct.client_id = p_client_id
    AND COALESCE(q.is_deleted, false) = false
),
filtered AS (
  SELECT * FROM base b
  WHERE (p_queue_ids IS NULL OR array_length(p_queue_ids, 1) IS NULL OR b.queue_id = ANY(p_queue_ids))
    AND (p_tab IS NULL OR (p_tab = 'groups' AND b.is_group) OR (p_tab = 'individual' AND NOT b.is_group))
    AND (
      p_status IS NULL
      OR (p_status = 'resolved_closed' AND b.status IN ('resolved','closed'))
      OR b.status = p_status
    )
    AND (p_owner IS NULL OR b.assigned_to = p_owner)
    AND (p_unassigned IS NOT TRUE OR b.assigned_to IS NULL OR b.assigned_to = '')
    AND (p_priority IS NULL OR b.priority = p_priority)
    AND (
      p_search IS NULL OR p_search = ''
      OR b.contact_name ILIKE '%' || p_search || '%'
      OR b.phone ILIKE '%' || p_search || '%'
      OR COALESCE(b.lead_full_name, '') ILIKE '%' || p_search || '%'
      OR COALESCE(b.protocol, '') ILIKE '%' || p_search || '%'
    )
    AND (p_from IS NULL OR COALESCE(b.last_message_at, b.conversation_updated_at) >= p_from)
    AND (p_to IS NULL OR COALESCE(b.last_message_at, b.conversation_updated_at) <= p_to)
    AND (p_tag_ids IS NULL OR array_length(p_tag_ids, 1) IS NULL OR b.tag_ids && p_tag_ids)
    AND (p_has_ticket IS NULL OR (p_has_ticket AND b.active_ticket_id IS NOT NULL) OR (NOT p_has_ticket AND b.active_ticket_id IS NULL))
    AND (p_has_crm_builder IS NULL OR (p_has_crm_builder AND b.crm_board_name IS NOT NULL) OR (NOT p_has_crm_builder AND b.crm_board_name IS NULL))
),
counted AS (
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
    COUNT(*) FILTER (WHERE status = 'open')::int AS open,
    COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
    COUNT(*) FILTER (WHERE status = 'closed')::int AS closed,
    COALESCE(SUM(unread_count), 0)::int AS unread
  FROM filtered
),
page AS (
  SELECT * FROM filtered
  ORDER BY
    CASE WHEN p_sort = 'unread' THEN unread_count ELSE 0 END DESC,
    CASE WHEN p_sort = 'oldest' THEN COALESCE(last_message_at, conversation_updated_at) END ASC NULLS LAST,
    CASE WHEN p_sort <> 'oldest' THEN COALESCE(last_message_at, conversation_updated_at) END DESC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limit, 30), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
)
SELECT jsonb_build_object(
  'counters', (SELECT to_jsonb(c) FROM counted c),
  'rows', COALESCE((SELECT jsonb_agg(to_jsonb(p) - 'tag_ids') FROM page p), '[]'::jsonb)
);
$$;

REVOKE ALL ON FUNCTION public.mvp_chat_list_feed(text, uuid[], text, text, text, boolean, text, timestamptz, timestamptz, uuid[], text, boolean, boolean, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mvp_chat_list_feed(text, uuid[], text, text, text, boolean, text, timestamptz, timestamptz, uuid[], text, boolean, boolean, text, integer, integer) TO authenticated, service_role, anon;