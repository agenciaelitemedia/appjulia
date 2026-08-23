DO $do$
DECLARE
  src text;
  s1  text;
  s2  text;
  s3  text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'mvp_chat_list_feed'
   ORDER BY p.pronargs DESC
   LIMIT 1;

  IF src IS NULL THEN
    RAISE EXCEPTION 'mvp_chat_list_feed não encontrada';
  END IF;

  -- 1) desempate determinístico na ordenação
  s1 := replace(
    src,
    E'\n  v_sql := format($q$',
    E'\n  v_order := v_order || '', conversation_id DESC'';\n  v_sql := format($q$'
  );
  IF s1 = src THEN RAISE EXCEPTION 'patch 1 (desempate) não aplicado'; END IF;

  -- 2) guarda a posição real da página
  s2 := replace(
    s1,
    E'        FROM leaders l ORDER BY %3$s LIMIT %4$s OFFSET %5$s',
    E'        , row_number() OVER (ORDER BY %3$s) AS ord\n        FROM leaders l ORDER BY %3$s LIMIT %4$s OFFSET %5$s'
  );
  IF s2 = s1 THEN RAISE EXCEPTION 'patch 2 (ord) não aplicado'; END IF;

  -- 3) agrega o JSON final na ordem correta
  s3 := replace(
    s2,
    E'      ''rows'', COALESCE((SELECT jsonb_agg(to_jsonb(p) - ''sla_first_target'' - ''sla_nrt_target'' - ''sla_res_target'' - ''rn'') FROM page p), ''[]''::jsonb)',
    E'      ''rows'', COALESCE((SELECT jsonb_agg(to_jsonb(p) - ''sla_first_target'' - ''sla_nrt_target'' - ''sla_res_target'' - ''rn'' - ''ord'' ORDER BY p.ord) FROM page p), ''[]''::jsonb)'
  );
  IF s3 = s2 THEN RAISE EXCEPTION 'patch 3 (ordem do jsonb_agg) não aplicado'; END IF;

  EXECUTE s3;
END
$do$;