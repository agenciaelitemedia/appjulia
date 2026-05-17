
CREATE OR REPLACE FUNCTION public.apply_queue_limit_from_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order        public.queue_orders%ROWTYPE;
  v_max_queues   int;
  v_extra        int;
  v_delta        int;
  v_client_text  text;
  v_settings_id  uuid;
  v_cur_settings jsonb;
  v_cur_limit    int;
  v_new_limit    int;
BEGIN
  -- Serializa invocações concorrentes no mesmo pedido
  SELECT * INTO v_order
  FROM public.queue_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Idempotência: flag commitada junto com o incremento => seguro contra retries
  IF COALESCE((v_order.metadata->>'queue_limit_applied')::boolean, false) THEN
    RETURN jsonb_build_object(
      'status', 'already_applied',
      'delta',  COALESCE((v_order.metadata->>'queue_limit_delta')::int, 0),
      'new_total', COALESCE((v_order.metadata->>'queue_limit_new_total')::int, NULL)
    );
  END IF;

  SELECT COALESCE(max_queues, 0) INTO v_max_queues
  FROM public.queue_plans WHERE id = v_order.plan_id;

  v_max_queues := COALESCE(v_max_queues, 0);
  v_extra      := COALESCE(v_order.extra_queues, 0);
  v_delta      := v_max_queues + v_extra;
  v_client_text := v_order.client_id;

  IF v_delta <= 0 THEN
    UPDATE public.queue_orders
    SET metadata = COALESCE(metadata, '{}'::jsonb)
                || jsonb_build_object('queue_limit_applied', true,
                                      'queue_limit_delta', 0),
        updated_at = now()
    WHERE id = p_order_id;
    RETURN jsonb_build_object('status', 'ok', 'delta', 0);
  END IF;

  SELECT id, settings INTO v_settings_id, v_cur_settings
  FROM public.chat_client_settings
  WHERE client_id = v_client_text
  FOR UPDATE;

  IF v_settings_id IS NULL THEN
    v_new_limit := v_delta;
    INSERT INTO public.chat_client_settings (client_id, client_name, client_business_name, settings)
    VALUES (
      v_client_text,
      v_order.customer_name,
      NULL,
      jsonb_build_object('QUEUE_LIMIT', v_new_limit, 'ALLOW_GROUPS', false)
    );
  ELSE
    v_cur_limit := COALESCE((v_cur_settings->>'QUEUE_LIMIT')::int, 1);
    v_new_limit := v_cur_limit + v_delta;
    UPDATE public.chat_client_settings
    SET settings = COALESCE(settings, '{}'::jsonb)
                || jsonb_build_object('QUEUE_LIMIT', v_new_limit),
        updated_at = now()
    WHERE id = v_settings_id;
  END IF;

  UPDATE public.queue_orders
  SET metadata = COALESCE(metadata, '{}'::jsonb)
              || jsonb_build_object(
                   'queue_limit_applied',   true,
                   'queue_limit_delta',     v_delta,
                   'queue_limit_new_total', v_new_limit
                 ),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'delta',  v_delta,
    'new_total', v_new_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_queue_limit_from_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_queue_limit_from_order(uuid) TO service_role;
