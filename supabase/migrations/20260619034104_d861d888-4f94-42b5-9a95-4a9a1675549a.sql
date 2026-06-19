
CREATE OR REPLACE FUNCTION public.get_team_online_seconds_by_day(p_user_ids bigint[], p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(user_id bigint, day_brt date, online_seconds bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH params AS (
    SELECT
      COALESCE(p_user_ids, ARRAY[]::bigint[]) AS user_ids,
      p_from AS from_ts,
      p_to   AS to_ts,
      (p_from AT TIME ZONE 'America/Sao_Paulo')::date AS from_day,
      ((p_to - interval '1 second') AT TIME ZONE 'America/Sao_Paulo')::date AS to_day,
      -- Maior dia já consolidado em user_presence_daily para os usuários consultados.
      -- Tudo a partir do dia seguinte é calculado on-the-fly nos heartbeats brutos,
      -- evitando "janela cega" entre a virada do dia BRT e a execução do cron de rollup.
      COALESCE(
        (SELECT max(day_brt) FROM public.user_presence_daily
          WHERE user_id = ANY (COALESCE(p_user_ids, ARRAY[]::bigint[]))),
        '1900-01-01'::date
      ) AS last_rolled_day
  ),
  cold AS (
    SELECT
      d.user_id::bigint,
      d.day_brt,
      SUM(d.online_seconds)::bigint AS online_seconds
    FROM public.user_presence_daily d
    CROSS JOIN params p
    WHERE d.user_id = ANY (p.user_ids)
      AND d.day_brt >= p.from_day
      AND d.day_brt <= LEAST(p.to_day, p.last_rolled_day)
    GROUP BY d.user_id, d.day_brt
  ),
  hot_slots AS (
    SELECT DISTINCT
      h.user_id::bigint,
      (h.seen_at AT TIME ZONE 'America/Sao_Paulo')::date AS day_brt,
      floor(extract(epoch FROM h.seen_at) / 30)::bigint AS slot
    FROM public.user_presence_heartbeats h
    CROSS JOIN params p
    WHERE h.user_id = ANY (p.user_ids)
      AND h.seen_at >= GREATEST(
            p.from_ts,
            ((p.last_rolled_day + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
          )
      AND h.seen_at < p.to_ts
  ),
  hot AS (
    SELECT
      hs.user_id,
      hs.day_brt,
      (count(*) * 30)::bigint AS online_seconds
    FROM hot_slots hs
    GROUP BY hs.user_id, hs.day_brt
  )
  SELECT c.user_id, c.day_brt, c.online_seconds FROM cold c
  UNION ALL
  SELECT h.user_id, h.day_brt, h.online_seconds FROM hot h
  ORDER BY day_brt, user_id;
$function$;
