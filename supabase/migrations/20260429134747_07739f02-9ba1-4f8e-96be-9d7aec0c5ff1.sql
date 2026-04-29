-- ============================================================
-- Fase 1: Schema aditivo (não-destrutivo)
-- ============================================================
ALTER TABLE public.phone_config     ADD COLUMN IF NOT EXISTS client_id BIGINT;
ALTER TABLE public.phone_extensions ADD COLUMN IF NOT EXISTS client_id BIGINT;
ALTER TABLE public.phone_user_plans ADD COLUMN IF NOT EXISTS client_id BIGINT;
ALTER TABLE public.phone_call_logs  ADD COLUMN IF NOT EXISTS client_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_phone_config_client_id     ON public.phone_config (client_id);
CREATE INDEX IF NOT EXISTS idx_phone_extensions_client_id ON public.phone_extensions (client_id);
CREATE INDEX IF NOT EXISTS idx_phone_user_plans_client_id ON public.phone_user_plans (client_id);
CREATE INDEX IF NOT EXISTS idx_phone_call_logs_client_id  ON public.phone_call_logs (client_id);

-- ============================================================
-- Fase 2: Backfill (mapa cod_agent → client_id já validado)
-- ============================================================
WITH map(cod_agent, client_id) AS (
  VALUES
    ('20251007'::text,  270::bigint),
    ('202601003'::text, 288::bigint),
    ('202603001'::text, 294::bigint),
    ('202603002'::text, 295::bigint),
    ('20259084'::text,  300::bigint)
)
UPDATE public.phone_config p
   SET client_id = m.client_id
  FROM map m
 WHERE p.cod_agent = m.cod_agent AND p.client_id IS NULL;

WITH map(cod_agent, client_id) AS (
  VALUES
    ('20251007'::text,  270::bigint),
    ('202601003'::text, 288::bigint),
    ('202603001'::text, 294::bigint),
    ('202603002'::text, 295::bigint),
    ('20259084'::text,  300::bigint)
)
UPDATE public.phone_extensions p
   SET client_id = m.client_id
  FROM map m
 WHERE p.cod_agent = m.cod_agent AND p.client_id IS NULL;

WITH map(cod_agent, client_id) AS (
  VALUES
    ('20251007'::text,  270::bigint),
    ('202601003'::text, 288::bigint),
    ('202603001'::text, 294::bigint),
    ('202603002'::text, 295::bigint),
    ('20259084'::text,  300::bigint)
)
UPDATE public.phone_user_plans p
   SET client_id = m.client_id
  FROM map m
 WHERE p.cod_agent = m.cod_agent AND p.client_id IS NULL;

WITH map(cod_agent, client_id) AS (
  VALUES
    ('20251007'::text,  270::bigint),
    ('202601003'::text, 288::bigint),
    ('202603001'::text, 294::bigint),
    ('202603002'::text, 295::bigint),
    ('20259084'::text,  300::bigint)
)
UPDATE public.phone_call_logs p
   SET client_id = m.client_id
  FROM map m
 WHERE p.cod_agent = m.cod_agent AND p.client_id IS NULL;