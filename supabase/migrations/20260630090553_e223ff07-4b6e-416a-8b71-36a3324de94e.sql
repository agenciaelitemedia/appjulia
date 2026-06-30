
-- 1) Novas colunas
ALTER TABLE public.wavoip_devices
  ADD COLUMN IF NOT EXISTS friendly_code text,
  ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_jids jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS wavoip_devices_friendly_code_uidx
  ON public.wavoip_devices(friendly_code) WHERE friendly_code IS NOT NULL;

-- 2) Função para gerar friendly_code único (4 caracteres A-Z0-9)
CREATE OR REPLACE FUNCTION public.gen_wavoip_friendly_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_code  text;
  v_try   int := 0;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..4 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random()*length(v_chars))::int, 1);
    END LOOP;
    PERFORM 1 FROM public.wavoip_devices WHERE friendly_code = v_code;
    IF NOT FOUND THEN RETURN v_code; END IF;
    v_try := v_try + 1;
    IF v_try > 50 THEN RAISE EXCEPTION 'unable to generate unique friendly_code'; END IF;
  END LOOP;
END;
$$;

-- 3) Backfill: registros existentes ganham friendly_code; status normalizado
UPDATE public.wavoip_devices
   SET friendly_code = public.gen_wavoip_friendly_code()
 WHERE friendly_code IS NULL;

UPDATE public.wavoip_devices
   SET device_name = 'WAPhone_' || friendly_code
 WHERE device_name IS NULL OR device_name = '';

UPDATE public.wavoip_devices
   SET status = CASE WHEN client_id IS NOT NULL THEN 'in_use' ELSE 'free' END
 WHERE status NOT IN ('free','in_use');

ALTER TABLE public.wavoip_devices
  ALTER COLUMN status SET DEFAULT 'free';

-- 4) Função para alocar dispositivos livres a um plano de cliente
CREATE OR REPLACE FUNCTION public.assign_wavoip_devices_to_plan(
  p_device_ids uuid[],
  p_user_plan_id uuid,
  p_client_id bigint
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  IF p_device_ids IS NULL OR array_length(p_device_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- valida que todos estão livres
  IF EXISTS (
    SELECT 1 FROM public.wavoip_devices
     WHERE id = ANY(p_device_ids) AND status <> 'free'
  ) THEN
    RAISE EXCEPTION 'one or more devices are not free';
  END IF;

  UPDATE public.wavoip_devices
     SET status = 'in_use',
         client_id = p_client_id,
         user_plan_id = p_user_plan_id,
         updated_at = now()
   WHERE id = ANY(p_device_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 5) Função para liberar dispositivos quando o plano é desativado/removido
CREATE OR REPLACE FUNCTION public.release_wavoip_devices_from_plan(p_user_plan_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.wavoip_devices
     SET status = 'free',
         client_id = NULL,
         user_plan_id = NULL,
         user_id = NULL,
         connection_status = 'disconnected',
         connected_at = NULL,
         whatsapp_jids = '[]'::jsonb,
         updated_at = now()
   WHERE user_plan_id = p_user_plan_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gen_wavoip_friendly_code() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_wavoip_devices_to_plan(uuid[], uuid, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_wavoip_devices_from_plan(uuid) TO authenticated, service_role;
