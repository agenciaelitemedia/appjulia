create or replace function public.server_now_brt()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select to_char(
    now() at time zone 'America/Sao_Paulo',
    'YYYY-MM-DD"T"HH24:MI:SS.MS'
  ) || '-03:00';
$$;

grant execute on function public.server_now_brt() to anon, authenticated, service_role;