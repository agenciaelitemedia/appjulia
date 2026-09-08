CREATE OR REPLACE FUNCTION public.migration_list_columns(p_table text)
RETURNS TABLE(
  column_name text,
  data_type text,
  character_maximum_length integer,
  numeric_precision integer,
  numeric_scale integer,
  udt_name text,
  column_default text,
  is_nullable text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.column_name::text,
         c.data_type::text,
         c.character_maximum_length::int,
         c.numeric_precision::int,
         c.numeric_scale::int,
         c.udt_name::text,
         c.column_default::text,
         c.is_nullable::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = p_table
  ORDER BY c.ordinal_position
$$;

GRANT EXECUTE ON FUNCTION public.migration_list_columns(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.migration_list_columns(text) TO service_role;