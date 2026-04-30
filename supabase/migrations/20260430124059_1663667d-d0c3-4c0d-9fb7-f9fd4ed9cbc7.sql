UPDATE public.telephony_orders 
SET status = 'provisioned',
    provisioned_at = now(),
    config_id = 16,
    user_plan_id = 21,
    provisioning_error = NULL,
    updated_at = now()
WHERE id = '3489c399-69c3-4eac-a917-b5713571d68f';

-- Limpa user_plans órfãos criados durante as tentativas (mantém apenas o id=21 ativo)
DELETE FROM public.phone_user_plans 
WHERE source_order_id = '3489c399-69c3-4eac-a917-b5713571d68f' 
  AND id <> 21;