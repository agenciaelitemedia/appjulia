-- Helpdesk / support tickets (Julia → escritórios).
-- RLS permissiva (autorização na app, como o resto do projeto) + realtime.

create table if not exists public.support_departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.support_categories (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.support_departments(id) on delete set null,
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.support_settings (
  id text primary key default 'global',
  sla jsonb not null default '{
    "low":{"firstResponseMins":480,"resolutionMins":2880},
    "normal":{"firstResponseMins":240,"resolutionMins":1440},
    "high":{"firstResponseMins":120,"resolutionMins":480},
    "urgent":{"firstResponseMins":30,"resolutionMins":240}
  }'::jsonb,
  csat_enabled boolean not null default true,
  updated_at timestamptz default now()
);
insert into public.support_settings (id) values ('global') on conflict (id) do nothing;

create table if not exists public.support_ticket_counters (
  id text primary key default 'global',
  last_number int not null default 0
);
insert into public.support_ticket_counters (id) values ('global') on conflict (id) do nothing;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  number int,
  subject text not null,
  description text,
  status text not null default 'open' check (status in ('open','pending','in_progress','waiting_customer','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  department_id uuid references public.support_departments(id) on delete set null,
  category_id uuid references public.support_categories(id) on delete set null,
  requester_user_id text,
  requester_client_id text,
  requester_name text,
  requester_email text,
  requester_phone text,
  assigned_to text,
  assigned_to_name text,
  tags text[] not null default '{}',
  conversation_id uuid,
  contact_id uuid,
  opened_at timestamptz default now(),
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  reopened_count int not null default 0,
  sla_first_response_due_at timestamptz,
  sla_resolution_due_at timestamptz,
  resolution_note text,
  csat_score int check (csat_score between 1 and 5),
  csat_comment text,
  csat_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_user_id text,
  author_name text,
  author_role text check (author_role in ('requester','agent','system')),
  kind text not null default 'public' check (kind in ('public','internal','event')),
  event_type text,
  body text,
  attachments jsonb,
  created_at timestamptz default now()
);

create or replace function public.set_support_ticket_number()
returns trigger language plpgsql
set search_path = public
as $$
declare n int;
begin
  if new.number is null then
    update public.support_ticket_counters
      set last_number = last_number + 1
      where id = 'global'
      returning last_number into n;
    new.number := n;
  end if;
  return new;
end $$;

drop trigger if exists trg_set_support_ticket_number on public.support_tickets;
create trigger trg_set_support_ticket_number
  before insert on public.support_tickets
  for each row execute function public.set_support_ticket_number();

create or replace function public.touch_support_tickets_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_touch_support_tickets on public.support_tickets;
create trigger trg_touch_support_tickets
  before update on public.support_tickets
  for each row execute function public.touch_support_tickets_updated_at();

alter table public.support_departments enable row level security;
alter table public.support_categories enable row level security;
alter table public.support_settings enable row level security;
alter table public.support_ticket_counters enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

do $$
declare t text;
begin
  foreach t in array array['support_departments','support_categories','support_settings','support_ticket_counters','support_tickets','support_ticket_messages']
  loop
    execute format('drop policy if exists "%s open" on public.%I', t, t);
    execute format('create policy "%s open" on public.%I for all using (true) with check (true)', t, t);
  end loop;
end $$;

alter table public.support_tickets replica identity full;
alter table public.support_ticket_messages replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='support_tickets') then
    execute 'alter publication supabase_realtime add table public.support_tickets';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='support_ticket_messages') then
    execute 'alter publication supabase_realtime add table public.support_ticket_messages';
  end if;
end $$;

create index if not exists idx_tickets_status on public.support_tickets (status);
create index if not exists idx_tickets_assigned on public.support_tickets (assigned_to);
create index if not exists idx_tickets_requester on public.support_tickets (requester_user_id);
create index if not exists idx_tickets_requester_client on public.support_tickets (requester_client_id);
create index if not exists idx_tickets_department on public.support_tickets (department_id);
create index if not exists idx_tickets_created on public.support_tickets (created_at desc);
create index if not exists idx_ticket_messages_ticket on public.support_ticket_messages (ticket_id, created_at);