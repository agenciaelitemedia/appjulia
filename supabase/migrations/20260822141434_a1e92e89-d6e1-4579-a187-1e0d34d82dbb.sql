CREATE OR REPLACE FUNCTION public.mvp_chat_list_feed(
  p_client_id text,
  p_queue_ids uuid[] DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_tab text DEFAULT NULL,
  p_owner text DEFAULT NULL,
  p_unassigned boolean DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_tag_ids uuid[] DEFAULT NULL,
  p_priority text DEFAULT NULL,
  p_has_ticket boolean DEFAULT NULL,
  p_has_crm_builder boolean DEFAULT NULL,
  p_sort text DEFAULT 'recent',
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_where text := '';
  v_order text;
  v_sql   text;
  v_out   jsonb;
  v_limit int := GREATEST(COALESCE(p_limit, 30), 1);
  v_off   int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF p_queue_ids IS NOT NULL AND array_length(p_queue_ids, 1) > 0 THEN
    v_where := v_where || format(' AND b.queue_id = ANY(%L::uuid[])', p_queue_ids);
  END IF;
  IF p_tab = 'groups' THEN
    v_where := v_where || ' AND b.is_group';
  ELSIF p_tab = 'individual' THEN
    v_where := v_where || ' AND NOT b.is_group';
  END IF;
  IF p_status = 'resolved_closed' THEN
    v_where := v_where || ' AND b.status IN (''resolved'',''closed'')';
  ELSIF p_status IS NOT NULL AND p_status <> '' THEN
    v_where := v_where || format(' AND b.status = %L', p_status);
  END IF;
  IF p_owner IS NOT NULL AND p_owner <> '' THEN
    v_where := v_where || format(' AND b.assigned_to = %L', p_owner);
  END IF;
  IF p_unassigned IS TRUE THEN
    v_where := v_where || ' AND COALESCE(b.assigned_to, '''') = ''''';
  END IF;
  IF p_priority IS NOT NULL AND p_priority <> '' THEN
    v_where := v_where || format(' AND b.priority = %L', p_priority);
  END IF;
  IF p_search IS NOT NULL AND p_search <> '' THEN
    v_where := v_where || format(
      ' AND (b.contact_name ILIKE %L OR b.phone ILIKE %L OR COALESCE(b.lead_full_name,'''') ILIKE %L OR COALESCE(b.protocol,'''') ILIKE %L)',
      '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%');
  END IF;
  IF p_from IS NOT NULL THEN
    v_where := v_where || format(' AND COALESCE(b.last_message_at, b.conversation_updated_at) >= %L::timestamptz', p_from);
  END IF;
  IF p_to IS NOT NULL THEN
    v_where := v_where || format(' AND COALESCE(b.last_message_at, b.conversation_updated_at) <= %L::timestamptz', p_to);
  END IF;
  IF p_tag_ids IS NOT NULL AND array_length(p_tag_ids, 1) > 0 THEN
    v_where := v_where || format(' AND b.tag_ids && %L::uuid[]', p_tag_ids);
  END IF;
  IF p_has_ticket IS TRUE THEN
    v_where := v_where || ' AND b.active_ticket_id IS NOT NULL';
  ELSIF p_has_ticket IS FALSE THEN
    v_where := v_where || ' AND b.active_ticket_id IS NULL';
  END IF;
  IF p_has_crm_builder IS TRUE THEN
    v_where := v_where || ' AND b.crm_board_name IS NOT NULL';
  ELSIF p_has_crm_builder IS FALSE THEN
    v_where := v_where || ' AND b.crm_board_name IS NULL';
  END IF;

  v_order := CASE
    WHEN p_sort = 'unread' THEN 'unread_count DESC, COALESCE(last_message_at, conversation_updated_at) DESC NULLS LAST'
    WHEN p_sort = 'oldest' THEN 'COALESCE(last_message_at, conversation_updated_at) ASC NULLS LAST'
    ELSE 'COALESCE(last_message_at, conversation_updated_at) DESC NULLS LAST'
  END;

  v_sql := format($q$
    WITH leader AS (
      SELECT DISTINCT ON (c.contact_id) c.*
        FROM public.chat_conversations c
       WHERE c.client_id = %1$L
       ORDER BY c.contact_id, c.updated_at DESC NULLS LAST, c.opened_at DESC NULLS LAST, c.created_at DESC
    ),
    builder AS (
      SELECT DISTINCT ON (link_kind, link_key)
             link_kind, link_key, board_name, board_color, pipeline_name, pipeline_color
        FROM (
          SELECT 'conv'::text AS link_kind,
                 (d.custom_fields->'links'->'chat'->>'conversation_id') AS link_key,
                 bo.name AS board_name, bo.color AS board_color,
                 pi.name AS pipeline_name, pi.color AS pipeline_color,
                 d.updated_at AS d_updated
            FROM public.crm_deals d
            LEFT JOIN public.crm_boards bo ON bo.id = d.board_id
            LEFT JOIN public.crm_pipelines pi ON pi.id = d.pipeline_id
           WHERE d.client_id = %1$L AND COALESCE(d.status,'') <> 'archived'
             AND (d.custom_fields->'links'->'chat'->>'conversation_id') IS NOT NULL
          UNION ALL
          SELECT 'contact'::text,
                 (d.custom_fields->'links'->'chat'->>'contact_id'),
                 bo.name, bo.color, pi.name, pi.color, d.updated_at
            FROM public.crm_deals d
            LEFT JOIN public.crm_boards bo ON bo.id = d.board_id
            LEFT JOIN public.crm_pipelines pi ON pi.id = d.pipeline_id
           WHERE d.client_id = %1$L AND COALESCE(d.status,'') <> 'archived'
             AND (d.custom_fields->'links'->'chat'->>'contact_id') IS NOT NULL
        ) u
       ORDER BY link_kind, link_key, d_updated DESC NULLS LAST
    ),
    base AS (
      SELECT
        ct.id AS contact_id, ct.name AS contact_name, ct.phone, ct.avatar,
        ct.avatar_storage_path, ct.is_group, ct.unread_count,
        ct.last_message_at, ct.last_message_text, ct.channel_source, ct.channel_type,
        ct.lead_full_name,
        l.id AS conversation_id, l.queue_id, q.name AS queue_name, q.is_active AS queue_is_active,
        l.channel,
        CASE WHEN l.status = 'pending' AND COALESCE(l.assigned_to,'') <> '' THEN 'open' ELSE l.status END AS status,
        l.protocol, l.assigned_to, l.assigned_user_id, l.priority,
        l.opened_at, l.first_response_at, l.resolved_at, l.closed_at,
        l.snoozed_until, l.snooze_reason,
        l.last_customer_message_at, l.last_message_from_me,
        l.updated_at AS conversation_updated_at,
        l.active_ticket_id, l.active_ticket_number, l.active_ticket_protocol,
        t.status AS ticket_status, t.priority AS ticket_priority, t.subject AS ticket_subject,
        qal.cod_agent AS queue_cod_agent,
        COALESCE(bc.board_name, bk.board_name) AS crm_board_name,
        COALESCE(bc.board_color, bk.board_color) AS crm_board_color,
        COALESCE(bc.pipeline_name, bk.pipeline_name) AS crm_pipeline_name,
        COALESCE(bc.pipeline_color, bk.pipeline_color) AS crm_pipeline_color,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', tg.id, 'name', tg.name, 'color', tg.color))
            FROM public.chat_conversation_tags cvt
            JOIN public.chat_tags tg ON tg.id = cvt.tag_id
           WHERE cvt.conversation_id = l.id
        ), '[]'::jsonb) AS tags,
        (SELECT array_agg(cvt2.tag_id) FROM public.chat_conversation_tags cvt2 WHERE cvt2.conversation_id = l.id) AS tag_ids
      FROM leader l
      JOIN public.chat_contacts ct ON ct.id = l.contact_id
      LEFT JOIN public.queues q ON q.id = l.queue_id
      LEFT JOIN public.support_tickets t ON t.id = l.active_ticket_id
      LEFT JOIN LATERAL (
        SELECT k.cod_agent FROM public.queue_agent_links k
         WHERE k.queue_id = l.queue_id
         ORDER BY k.is_primary DESC NULLS LAST, k.created_at ASC LIMIT 1
      ) qal ON true
      LEFT JOIN builder bc ON bc.link_kind = 'conv' AND bc.link_key = l.id::text
      LEFT JOIN builder bk ON bk.link_kind = 'contact' AND bk.link_key = l.contact_id::text
      WHERE ct.client_id = %1$L AND COALESCE(q.is_deleted, false) = false
    ),
    filtered AS (
      SELECT * FROM base b WHERE true %2$s
    ),
    counted AS (
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
             COUNT(*) FILTER (WHERE status = 'open')::int AS open,
             COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
             COUNT(*) FILTER (WHERE status = 'closed')::int AS closed,
             COALESCE(SUM(unread_count),0)::int AS unread
        FROM filtered
    ),
    page AS (
      SELECT * FROM filtered ORDER BY %3$s LIMIT %4$s OFFSET %5$s
    )
    SELECT jsonb_build_object(
      'counters', (SELECT to_jsonb(c) FROM counted c),
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(p) - 'tag_ids') FROM page p), '[]'::jsonb)
    )
  $q$, p_client_id, v_where, v_order, v_limit, v_off);

  EXECUTE v_sql INTO v_out;
  RETURN v_out;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mvp_chat_list_feed(text, uuid[], text, text, text, boolean, text, timestamptz, timestamptz, uuid[], text, boolean, boolean, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_chat_list_feed(text, uuid[], text, text, text, boolean, text, timestamptz, timestamptz, uuid[], text, boolean, boolean, text, integer, integer) TO service_role;