CREATE TABLE public.chat_contact_memory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.chat_contacts(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('profile_context','needs_case','pains_objections','agreements_commitments','next_steps','team_observations')),
  content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 4000),
  source_type text NOT NULL CHECK (source_type IN ('message','audio','internal_note','observation','summary','manual')),
  source_message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  source_conversation_id uuid REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  source_summary_id uuid REFERENCES public.chat_conversation_summaries(id) ON DELETE SET NULL,
  source_at timestamptz,
  source_author text,
  confidence numeric(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by_user_id bigint,
  created_by_name text,
  updated_by_user_id bigint,
  updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.chat_contact_memory_items TO service_role;
ALTER TABLE public.chat_contact_memory_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_contact_memory_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_item_id uuid NOT NULL REFERENCES public.chat_contact_memory_items(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.chat_contacts(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created','updated','archived','restored')),
  previous_value jsonb,
  new_value jsonb,
  actor_user_id bigint,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.chat_contact_memory_history TO service_role;
ALTER TABLE public.chat_contact_memory_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_contact_memory_state (
  contact_id uuid PRIMARY KEY REFERENCES public.chat_contacts(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  last_processed_at timestamptz,
  last_source_at timestamptz,
  last_generated_at timestamptz,
  last_generated_by_user_id bigint,
  pending_source_count integer NOT NULL DEFAULT 0 CHECK (pending_source_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.chat_contact_memory_state TO service_role;
ALTER TABLE public.chat_contact_memory_state ENABLE ROW LEVEL SECURITY;

CREATE INDEX chat_contact_memory_items_contact_active_idx ON public.chat_contact_memory_items (client_id, contact_id, status, source_at DESC);
CREATE INDEX chat_contact_memory_items_source_message_idx ON public.chat_contact_memory_items (source_message_id) WHERE source_message_id IS NOT NULL;
CREATE INDEX chat_contact_memory_history_contact_idx ON public.chat_contact_memory_history (client_id, contact_id, created_at DESC);
CREATE INDEX chat_contact_memory_state_client_idx ON public.chat_contact_memory_state (client_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.chat_contact_memory_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER chat_contact_memory_items_touch
BEFORE UPDATE ON public.chat_contact_memory_items
FOR EACH ROW EXECUTE FUNCTION public.chat_contact_memory_touch_updated_at();

CREATE TRIGGER chat_contact_memory_state_touch
BEFORE UPDATE ON public.chat_contact_memory_state
FOR EACH ROW EXECUTE FUNCTION public.chat_contact_memory_touch_updated_at();