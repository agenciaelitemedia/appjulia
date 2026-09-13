create table if not exists public.internal_worker_tokens (
  name text primary key,
  token text not null,
  created_at timestamptz not null default now()
);

grant all on public.internal_worker_tokens to service_role;

alter table public.internal_worker_tokens enable row level security;

drop policy if exists "service role manages internal worker tokens" on public.internal_worker_tokens;
create policy "service role manages internal worker tokens"
on public.internal_worker_tokens for all to service_role using (true) with check (true);