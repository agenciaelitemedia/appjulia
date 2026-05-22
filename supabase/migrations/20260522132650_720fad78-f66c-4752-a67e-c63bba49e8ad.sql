-- Audit table for inbound messages that the webhook discards silently
-- (no_phone / group_blocked / no_id / group_no_id / no_agent). Lets admins
-- inspect propaganda/@lid/broadcast/newsletter messages that never reached the chat.
create table if not exists public.chat_dropped_messages (
  id uuid primary key default gen_random_uuid(),
  client_id text,
  queue_id uuid,
  queue_name text,
  source text not null default 'uazapi',   -- uazapi | waba | instagram
  reason text not null,                     -- no_phone | group_blocked | no_id | group_no_id | no_agent
  event text,
  chat_id text,                             -- raw JID/identifier as received
  from_me boolean default false,
  preview text,                             -- best-effort text/caption snippet
  raw_payload jsonb,
  created_at timestamptz default now()
);

alter table public.chat_dropped_messages enable row level security;

drop policy if exists "chat_dropped_messages open" on public.chat_dropped_messages;
create policy "chat_dropped_messages open" on public.chat_dropped_messages
  for all using (true) with check (true);

create index if not exists idx_dropped_created on public.chat_dropped_messages (created_at desc);
create index if not exists idx_dropped_client on public.chat_dropped_messages (client_id, created_at desc);