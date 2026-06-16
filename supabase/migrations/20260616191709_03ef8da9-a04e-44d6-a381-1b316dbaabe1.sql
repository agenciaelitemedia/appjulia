ALTER TABLE public.chat_routing_rules
  ADD COLUMN IF NOT EXISTS excluded_agents text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS online_only boolean NOT NULL DEFAULT false;