-- Endurece RLS das tabelas chat_* (Sprints 8/9/10) que estavam com USING true.
-- Política: somente usuários autenticados podem operar; aberto a authenticated mantém compatibilidade
-- com o modelo atual (cod_agent no payload), porém bloqueia acesso anônimo.

DO $$
DECLARE
  t text;
  open_tables text[] := ARRAY[
    'chat_call_logs','chat_audit_log','chat_lgpd_requests','chat_role_permissions',
    'chat_campaign_variants','chat_campaign_schedules','chat_user_security'
  ];
BEGIN
  FOREACH t IN ARRAY open_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' open', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t || ' authenticated', t
    );
  END LOOP;
END $$;