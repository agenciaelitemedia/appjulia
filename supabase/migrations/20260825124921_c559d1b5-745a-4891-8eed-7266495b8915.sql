-- 1) Remove o índice de fetched_at: encarece toda atualização do espelho e não
--    é usado por consulta do painel (a limpeza diária varre a tabela, que é pequena).
DROP INDEX IF EXISTS public.mvp_chat_legacy_cache_fetched_idx;

-- 2) Retenção: descarta linhas do espelho sem verificação há mais de 30 dias.
CREATE OR REPLACE FUNCTION public.chat_legacy_cache_cleanup()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.chat_legacy_cache
   WHERE fetched_at < now() - interval '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_legacy_cache_cleanup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_legacy_cache_cleanup() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_legacy_cache_cleanup() TO service_role;

-- 3) Agendamento diário (04:25 UTC), idempotente.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('chat_legacy_cache_cleanup')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'chat_legacy_cache_cleanup');
    PERFORM cron.schedule(
      'chat_legacy_cache_cleanup',
      '25 4 * * *',
      $cmd$SELECT public.chat_legacy_cache_cleanup();$cmd$
    );
  END IF;
END;
$$;