-- =====================================================================
-- TESTE: apply_queue_limit_from_order é idempotente em retries.
-- Cenário: 1ª chamada incrementa QUEUE_LIMIT e commita flag na MESMA
-- transação. Simulamos falha posterior disparando retries; a flag
-- commitada impede dupla soma.
-- Execução: roda em BEGIN..ROLLBACK — nada persiste.
-- =====================================================================
BEGIN;

DO $test$
DECLARE
  v_plan_id     bigint;
  v_max         int;
  v_extra       int := 2;
  v_expected    int;
  v_order_id    uuid;
  v_client_text text := 'test_idem_' || replace(gen_random_uuid()::text, '-', '');
  r1 jsonb; r2 jsonb; r3 jsonb;
  v_lim1 int; v_lim2 int; v_lim3 int;
  v_flag boolean;
BEGIN
  SELECT id, COALESCE(max_queues,0) INTO v_plan_id, v_max
  FROM public.queue_plans
  WHERE is_active = true AND COALESCE(max_queues,0) > 0
  ORDER BY id LIMIT 1;
  IF v_plan_id IS NULL THEN RAISE EXCEPTION 'no test plan available'; END IF;
  v_expected := v_max + v_extra;

  INSERT INTO public.queue_orders (
    client_id, customer_name, customer_document, customer_email,
    plan_id, plan_name, billing_period, extra_queues,
    plan_price, setup_fee, extra_queues_total, total_amount,
    status, paid_at, metadata
  ) VALUES (
    v_client_text, 'Idempotency Test', '00000000000', 'idem@test.local',
    v_plan_id, 'test', 'monthly', v_extra,
    0, 0, 0, 0, 'paid', now(), '{}'::jsonb
  ) RETURNING id INTO v_order_id;

  -- 1ª chamada: aplica
  r1 := public.apply_queue_limit_from_order(v_order_id);
  IF (r1->>'status') <> 'ok' THEN RAISE EXCEPTION 'FAIL r1=%', r1; END IF;
  IF (r1->>'delta')::int <> v_expected THEN
    RAISE EXCEPTION 'FAIL delta esperado=% obtido=%', v_expected, r1->>'delta';
  END IF;
  SELECT (settings->>'QUEUE_LIMIT')::int INTO v_lim1
    FROM public.chat_client_settings WHERE client_id = v_client_text;
  IF v_lim1 <> v_expected THEN
    RAISE EXCEPTION 'FAIL QUEUE_LIMIT após 1ª=%, esperado=%', v_lim1, v_expected;
  END IF;
  SELECT (metadata->>'queue_limit_applied')::boolean INTO v_flag
    FROM public.queue_orders WHERE id = v_order_id;
  IF v_flag IS NOT TRUE THEN RAISE EXCEPTION 'FAIL flag não commitada'; END IF;

  -- RETRY após "falha posterior"
  r2 := public.apply_queue_limit_from_order(v_order_id);
  IF (r2->>'status') <> 'already_applied' THEN
    RAISE EXCEPTION 'FAIL retry deveria retornar already_applied, obteve %', r2;
  END IF;
  SELECT (settings->>'QUEUE_LIMIT')::int INTO v_lim2
    FROM public.chat_client_settings WHERE client_id = v_client_text;
  IF v_lim2 <> v_expected THEN
    RAISE EXCEPTION 'FAIL DOBROU! QUEUE_LIMIT após retry=%, esperado=%', v_lim2, v_expected;
  END IF;

  -- 3ª chamada
  r3 := public.apply_queue_limit_from_order(v_order_id);
  IF (r3->>'status') <> 'already_applied' THEN
    RAISE EXCEPTION 'FAIL 3ª deveria retornar already_applied, obteve %', r3;
  END IF;
  SELECT (settings->>'QUEUE_LIMIT')::int INTO v_lim3
    FROM public.chat_client_settings WHERE client_id = v_client_text;
  IF v_lim3 <> v_expected THEN
    RAISE EXCEPTION 'FAIL múltiplos retries quebraram idempotência: %', v_lim3;
  END IF;

  RAISE NOTICE 'OK: idempotência confirmada — delta=%, QUEUE_LIMIT final=% após 3 chamadas',
    v_expected, v_lim3;
END
$test$;

ROLLBACK;
