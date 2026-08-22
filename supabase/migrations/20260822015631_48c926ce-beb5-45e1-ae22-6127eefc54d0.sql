-- ============================================================
-- X-Julia F4 (etapas 4-5): registro de webhooks rejeitados,
-- token por fila e auditoria de privilégios das tabelas xj_*.
-- ============================================================

-- 1) Auditoria de tentativas de webhook rejeitadas
CREATE TABLE IF NOT EXISTS public.webhook_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  reason text NOT NULL,
  queue_id uuid,
  client_id text,
  ip text,
  path text,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.webhook_rejections TO service_role;

ALTER TABLE public.webhook_rejections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_rejections service only" ON public.webhook_rejections;
CREATE POLICY "webhook_rejections service only"
  ON public.webhook_rejections FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_webhook_rejections_created
  ON public.webhook_rejections (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_rejections_source
  ON public.webhook_rejections (source, created_at DESC);

-- 2) Token opcional por fila para autenticar o webhook do provedor
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS webhook_token text;

-- 3) Tabelas do X-Julia que o painel só acessa via Edge Functions:
--    acesso exclusivo dos serviços internos.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'xj_client_provider_keys',
    'xj_provider_settings',
    'xj_inbound_queue',
    'xj_usage_limits',
    'xj_usage_counters'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "xj_usage_limits_read" ON public.xj_usage_limits;
DROP POLICY IF EXISTS "xj_usage_limits_authenticated_all" ON public.xj_usage_limits;
DROP POLICY IF EXISTS "xj_usage_counters_read" ON public.xj_usage_counters;
DROP POLICY IF EXISTS "xj_usage_counters_authenticated_read" ON public.xj_usage_counters;

CREATE POLICY "xj_usage_limits service only"
  ON public.xj_usage_limits FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "xj_usage_counters service only"
  ON public.xj_usage_counters FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 4) Nas demais tabelas xj_*, retira privilégios destrutivos/estruturais
--    (TRUNCATE, TRIGGER, REFERENCES, MAINTAIN) de anon/authenticated,
--    preservando SELECT/INSERT/UPDATE/DELETE usados pelo painel hoje.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relname LIKE 'xj\_%'
       AND c.relname NOT IN (
         'xj_client_provider_keys','xj_provider_settings',
         'xj_inbound_queue','xj_usage_limits','xj_usage_counters'
       )
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM anon, authenticated',
      r.relname
    );
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.relname);
  END LOOP;
END $$;