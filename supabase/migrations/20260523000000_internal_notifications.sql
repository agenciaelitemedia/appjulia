-- Internal notifications module ("Notificar Clientes").
-- Realtime broadcast of message/poll/question to system users. Recipients are
-- materialized (snapshot) at dispatch time so each client can subscribe to its
-- own rows and reports can show who was sent / who read / who answered.

create table if not exists public.internal_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  type text not null check (type in ('message','poll','question')),
  poll_options jsonb,                 -- string[] for type='poll'
  audience text not null check (audience in ('owners','teams','all')),
  scope text not null default 'office' check (scope in ('global','office')),
  created_by text not null,           -- external user id of creator
  created_by_name text,
  created_by_client_id text,          -- creator client_id (office scope)
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent','failed','canceled')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  recipients_total int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.internal_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.internal_notifications(id) on delete cascade,
  user_id text not null,              -- external user id of recipient
  user_name text,
  user_role text,
  client_id text,
  delivered_at timestamptz default now(),
  read_at timestamptz,                -- set when expanded (= "read")
  responded_at timestamptz,
  poll_choice text,                   -- chosen option (poll)
  response_text text,                 -- answer (question)
  dismissed boolean not null default false,  -- "Fechar" without responding
  created_at timestamptz default now(),
  unique (notification_id, user_id)
);

alter table public.internal_notifications enable row level security;
alter table public.internal_notification_recipients enable row level security;

drop policy if exists "internal_notifications open" on public.internal_notifications;
create policy "internal_notifications open" on public.internal_notifications for all using (true) with check (true);

drop policy if exists "internal_notification_recipients open" on public.internal_notification_recipients;
create policy "internal_notification_recipients open" on public.internal_notification_recipients for all using (true) with check (true);

alter table public.internal_notification_recipients replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'internal_notification_recipients'
  ) then
    execute 'alter publication supabase_realtime add table public.internal_notification_recipients';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'internal_notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.internal_notifications';
  end if;
end $$;

create index if not exists idx_inr_user_unread on public.internal_notification_recipients (user_id, read_at);
create index if not exists idx_inr_notification on public.internal_notification_recipients (notification_id);
create index if not exists idx_in_status_sched on public.internal_notifications (status, scheduled_for);
