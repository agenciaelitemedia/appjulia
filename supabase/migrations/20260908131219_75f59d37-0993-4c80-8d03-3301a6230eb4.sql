CREATE OR REPLACE FUNCTION public.migration_list_tables()
RETURNS TABLE(table_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.relname::text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY c.relname
$$;

GRANT EXECUTE ON FUNCTION public.migration_list_tables() TO authenticated;
GRANT EXECUTE ON FUNCTION public.migration_list_tables() TO anon;
GRANT EXECUTE ON FUNCTION public.migration_list_tables() TO service_role;