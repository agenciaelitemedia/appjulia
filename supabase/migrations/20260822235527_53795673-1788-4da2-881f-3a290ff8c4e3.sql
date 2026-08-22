DROP FUNCTION IF EXISTS public.mvp_chat_list_feed(text, uuid[], text, text, text, boolean, text, timestamptz, timestamptz, uuid[], text, boolean, boolean, text, integer, integer, text[], text[]);

CREATE OR REPLACE FUNCTION public.mvp_chat_list_feed(
  p_client_id text,
  p_queue_ids uuid[] DEFAULT NULL::uuid[],
  p_status text DEFAULT NULL::text,
  p_tab text DEFAULT NULL::text,
  p_owner text DEFAULT NULL::text,
  p_unassigned boolean DEFAULT NULL::boolean,
  p_search text DEFAULT NULL::text,
  p_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_tag_ids uuid[] DEFAULT NULL::uuid[],
  p_priority text DEFAULT NULL::text,
  p_has_ticket boolean DEFAULT NULL::boolean,
  p_has_crm_builder boolean DEFAULT NULL::boolean,
  p_sort text DEFAULT 'recent'::text,
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0,
  p_owners text[] DEFAULT NULL::text[],
  p_sla_status text[] DEFAULT NULL::text[],
  p_hide_snoozed boolean DEFAULT true,
  p_restrict_open_to text[] DEFAULT NULL::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '55s'
AS $function$
DECLARE
  v_where text := '';
  v_order text;
  v_sql   text;
  v_out   jsonb;
  v_limit int := GREATEST(COALESCE(p_limit, 30), 1);
  v_off   int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  -- Fila: casa por queue_id da conversa OU channel_source do contato (mesmo
  -- critério usado pela lista do /chat, que filtra contatos por channel_source).
  IF p_queue_ids IS NOT NULL AND array_length(p_queue_ids, 1) > 0 THEN
    v_where := v_where || format(
      ' AND (b.queue_id = ANY(%1$L::uuid[]) OR b.channel_source = ANY(%1$L::text[]))',
      p_queue_ids);
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

  IF p_owners IS NOT NULL AND array_length(p_owners, 1) > 0 THEN
    IF p_unassigned IS TRUE THEN
      v_where := v_where || format(
        ' AND (b.assigned_to = ANY(%L::text[]) OR COALESCE(b.assigned_to, '''') = '''')', p_owners);
    ELSE
      v_where := v_where || format(' AND b.assigned_to = ANY(%L::text[])', p_owners);
    END IF;
  ELSIF p_owner IS NOT NULL AND p_owner <> '' THEN
    IF p_unassigned IS TRUE THEN
      v_where := v_where || format(
        ' AND (b.assigned_to = %L OR COALESCE(b.assigned_to, '''') = '''')', p_owner);
    ELSE
      v_where := v_where || format(' AND b.assigned_to = %L', p_owner);
    END IF;
  ELSIF p_unassigned IS TRUE THEN
    v_where := v_where || ' AND COALESCE(b.assigned_to, '''') = ''''';
  ELSIF p_unassigned IS FALSE THEN
    v_where := v_where || ' AND COALESCE(b.assigned_to, '''') <> ''''';
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
    v_where := v_where || format(
      ' AND EXISTS (SELECT 1 FROM public.chat_conversation_tags x WHERE x.conversation_id = b.conversation_id AND x.tag_id = ANY(%L::uuid[]))',
      p_tag_ids);
  END IF;
  IF p_has_ticket IS TRUE THEN
    v_where := v_where || ' AND b.active_ticket_id IS NOT NULL';
  ELSIF p_has_ticket IS FALSE THEN
    v_where := v_where || ' AND b.active_ticket_id IS NULL';
  END IF;
  IF p_has_crm_builder IS TRUE THEN
    v_where := v_where || ' AND EXISTS (SELECT 1 FROM public.crm_deals d WHERE COALESCE(d.status,'''') <> ''archived''
       AND ((d.custom_fields->''links''->''chat''->>''conversation_id'') = b.conversation_id::text
         OR (d.custom_fields->''links''->''chat''->>''contact_id'') = b.contact_id::text))';
  ELSIF p_has_crm_builder IS FALSE THEN
    v_where := v_where || ' AND NOT EXISTS (SELECT 1 FROM public.crm_deals d WHERE COALESCE(d.status,'''') <> ''archived''
       AND ((d.custom_fields->''links''->''chat''->>''conversation_id'') = b.conversation_id::text
         OR (d.custom_fields->''links''->''chat''->>''contact_id'') = b.contact_id::text))';
  END IF;
  IF p_sla_status IS NOT NULL AND array_length(p_sla_status, 1) > 0 THEN
    v_where := v_where || format(' AND b.sla_status = ANY(%L::text[])', p_sla_status);
  END IF;
  -- Snooze: escondido por padrão (mesmo comportamento do /chat).
  IF COALESCE(p_hide_snoozed, true) THEN
    v_where := v_where || ' AND (b.snoozed_until IS NULL OR b.snoozed_until <= now())';
  END IF;
  -- Regra de papel: usuário não privilegiado só vê ''open'' atribuído a ele.
  IF p_restrict_open_to IS NOT NULL AND array_length(p_restrict_open_to, 1) > 0 THEN
    v_where := v_where || format(
      ' AND (b.status <> ''open'' OR b.assigned_to = ANY(%L::text[]))', p_restrict_open_to);
  END IF;

  v_order := CASE
    WHEN p_sort = 'unread' THEN 'unread_count DESC, COALESCE(last_message_at, conversation_updated_at) DESC NULLS LAST'
    WHEN p_sort = 'oldest' THEN 'COALESCE(last_message_at, conversation_updated_at) ASC NULLS LAST'
    WHEN p_sort = 'sla' THEN 'CASE sla_status WHEN ''breached'' THEN 0 WHEN ''at_risk'' THEN 1 WHEN ''on_track'' THEN 2 ELSE 3 END, sla_remaining_minutes ASC NULLS LAST, COALESCE(last_message_at, conversation_updated_at) DESC NULLS LAST'
    ELSE 'COALESCE(last_message_at, conversation_updated_at) DESC NULLS LAST'
  END;

  v_sql := format($q$
    WITH ranked AS (
      SELECT c.*,
             row_number() OVER (
               PARTITION BY c.contact_id
               ORDER BY c.updated_at DESC NULLS LAST, c.opened_at DESC NULLS LAST, c.created_at DESC
             ) AS rn
        FROM public.chat_conversations c
       WHERE c.client_id = %1$L
    ),
    sla_cfg AS (
      SELECT priority, first_response_minutes, nrt_response_minutes, resolution_minutes
        FROM public.chat_sla_configs
       WHERE client_id = %1$L AND is_active
    ),
    base AS (
      SELECT
        ct.id AS contact_id, ct.name AS contact_name, ct.phone, ct.avatar,
        ct.avatar_storage_path, ct.is_group, ct.unread_count,
        ct.last_message_at, ct.last_message_text, ct.channel_source, ct.channel_type,
        ct.lead_full_name,
        l.id AS conversation_id, l.queue_id, q.name AS queue_name, q.is_active AS queue_is_active,
        (l.rn = 1) AS is_leader,
        l.channel,
        CASE WHEN l.status = 'pending' AND COALESCE(l.assigned_to,'') <> '' THEN 'open' ELSE l.status END AS status,
        l.protocol, l.assigned_to, l.assigned_user_id, l.priority,
        l.opened_at, l.first_response_at, l.resolved_at, l.closed_at,
        l.snoozed_until, l.snooze_reason,
        l.last_customer_message_at, l.last_message_from_me,
        l.updated_at AS conversation_updated_at,
        l.active_ticket_id, l.active_ticket_number, l.active_ticket_protocol,
        COALESCE(cfg.first_response_minutes, dflt.first_m)  AS sla_first_target,
        COALESCE(cfg.nrt_response_minutes,   dflt.nrt_m)    AS sla_nrt_target,
        COALESCE(cfg.resolution_minutes,     dflt.res_m)    AS sla_res_target
      FROM ranked l
      JOIN public.chat_contacts ct ON ct.id = l.contact_id
      LEFT JOIN public.queues q ON q.id = l.queue_id
      LEFT JOIN sla_cfg cfg ON cfg.priority = l.priority
      LEFT JOIN LATERAL (
        SELECT * FROM (VALUES
          ('urgent', 15, 30, 240),
          ('high',   60, 120, 480),
          ('normal', 240, 240, 4320),
          ('low',    480, 480, 14400)
        ) v(prio, first_m, nrt_m, res_m)
        WHERE v.prio = COALESCE(l.priority, 'normal')
        UNION ALL SELECT 'normal', 240, 240, 4320
        LIMIT 1
      ) dflt ON true
      WHERE ct.client_id = %1$L
        AND COALESCE(q.is_deleted, false) = false
        AND COALESCE(q.is_active, true) = true
    ),
    enriched AS (
      SELECT b.*,
        CASE
          WHEN b.status IN ('resolved','closed') THEN 'ttr'
          WHEN b.first_response_at IS NULL THEN 'frt'
          WHEN b.last_message_from_me IS FALSE AND b.last_customer_message_at IS NOT NULL THEN 'nrt'
          ELSE 'ttr'
        END AS sla_type,
        s.rem AS sla_remaining_minutes,
        s.tgt AS sla_target_minutes,
        CASE
          WHEN b.status IN ('resolved','closed') THEN 'on_track'
          WHEN s.rem IS NULL THEN 'unknown'
          WHEN s.rem < 0 THEN 'breached'
          WHEN s.rem <= (s.tgt * 0.25) THEN 'at_risk'
          ELSE 'on_track'
        END AS sla_status
      FROM base b
      CROSS JOIN LATERAL (
        SELECT
          CASE
            WHEN b.status IN ('resolved','closed') THEN NULL
            WHEN b.first_response_at IS NULL
              THEN b.sla_first_target - (EXTRACT(EPOCH FROM (now() - b.opened_at)) / 60)::int
            WHEN b.last_message_from_me IS FALSE AND b.last_customer_message_at IS NOT NULL
              THEN b.sla_nrt_target - (EXTRACT(EPOCH FROM (now() - b.last_customer_message_at)) / 60)::int
            ELSE b.sla_res_target - (EXTRACT(EPOCH FROM (now() - b.opened_at)) / 60)::int
          END AS rem,
          CASE
            WHEN b.status IN ('resolved','closed') THEN b.sla_res_target
            WHEN b.first_response_at IS NULL THEN b.sla_first_target
            WHEN b.last_message_from_me IS FALSE AND b.last_customer_message_at IS NOT NULL THEN b.sla_nrt_target
            ELSE b.sla_res_target
          END AS tgt
      ) s
    ),
    filtered AS (
      SELECT * FROM enriched b WHERE true %2$s
    ),
    counted AS (
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
             COUNT(*) FILTER (WHERE status = 'open')::int AS open,
             COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
             COUNT(*) FILTER (WHERE status = 'closed')::int AS closed,
             COUNT(*) FILTER (WHERE is_leader)::int AS total_contacts,
             COALESCE(SUM(unread_count) FILTER (WHERE is_leader),0)::int AS unread,
             COUNT(*) FILTER (WHERE sla_status = 'breached')::int AS sla_breached,
             COUNT(*) FILTER (WHERE sla_status = 'at_risk')::int AS sla_at_risk
        FROM filtered
    ),
    leaders AS (
      SELECT * FROM filtered WHERE is_leader
    ),
    page_ids AS (
      SELECT l.*,
        (SELECT COUNT(*)::int FROM filtered f
          WHERE f.contact_id = l.contact_id AND f.conversation_id <> l.conversation_id
            AND f.status IN ('pending','open')) AS sibling_open_count
        FROM leaders l ORDER BY %3$s LIMIT %4$s OFFSET %5$s
    ),
    page AS (
      SELECT p.*,
        qal.cod_agent AS queue_cod_agent,
        t.status AS ticket_status, t.priority AS ticket_priority, t.subject AS ticket_subject,
        bd.board_name AS crm_board_name, bd.board_color AS crm_board_color,
        bd.pipeline_name AS crm_pipeline_name, bd.pipeline_color AS crm_pipeline_color,
        COALESCE(tg.tags, '[]'::jsonb) AS tags
      FROM page_ids p
      LEFT JOIN public.support_tickets t ON t.id = p.active_ticket_id
      LEFT JOIN LATERAL (
        SELECT k.cod_agent FROM public.queue_agent_links k
         WHERE k.queue_id = p.queue_id
         ORDER BY k.is_primary DESC NULLS LAST, k.created_at ASC LIMIT 1
      ) qal ON true
      LEFT JOIN LATERAL (
        SELECT bo.name AS board_name, bo.color AS board_color,
               pi.name AS pipeline_name, pi.color AS pipeline_color
          FROM public.crm_deals d
          LEFT JOIN public.crm_boards bo ON bo.id = d.board_id
          LEFT JOIN public.crm_pipelines pi ON pi.id = d.pipeline_id
         WHERE COALESCE(d.status,'') <> 'archived'
           AND ((d.custom_fields->'links'->'chat'->>'conversation_id') = p.conversation_id::text
             OR (d.custom_fields->'links'->'chat'->>'contact_id') = p.contact_id::text)
         ORDER BY ((d.custom_fields->'links'->'chat'->>'conversation_id') = p.conversation_id::text) DESC,
                  d.updated_at DESC NULLS LAST
         LIMIT 1
      ) bd ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('id', tg2.id, 'name', tg2.name, 'color', tg2.color)) AS tags
          FROM public.chat_conversation_tags cvt
          JOIN public.chat_tags tg2 ON tg2.id = cvt.tag_id
         WHERE cvt.conversation_id = p.conversation_id
      ) tg ON true
    )
    SELECT jsonb_build_object(
      'counters', (SELECT to_jsonb(c) FROM counted c),
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(p) - 'sla_first_target' - 'sla_nrt_target' - 'sla_res_target' - 'rn') FROM page p), '[]'::jsonb)
    )
  $q$, p_client_id, v_where, v_order, v_limit, v_off);

  EXECUTE v_sql INTO v_out;
  RETURN v_out;
END;
$function$;