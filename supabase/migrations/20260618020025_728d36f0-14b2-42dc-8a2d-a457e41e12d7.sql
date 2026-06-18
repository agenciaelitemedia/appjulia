
-- Add stable user id column alongside name-based assigned_to
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS assigned_user_id bigint;
ALTER TABLE public.crm_deals          ADD COLUMN IF NOT EXISTS assigned_user_id bigint;
ALTER TABLE public.support_tickets    ADD COLUMN IF NOT EXISTS assigned_user_id bigint;
ALTER TABLE public.tasks              ADD COLUMN IF NOT EXISTS assigned_user_id bigint;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_client_assigned_user
  ON public.chat_conversations(client_id, assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_client_assigned_user
  ON public.crm_deals(client_id, assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_client_assigned_user
  ON public.support_tickets(requester_client_id, assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_assigned_user
  ON public.tasks(client_id, assigned_user_id);

-- Propagar o id nas sincronizações entre chat_conversations <-> crm_deals
CREATE OR REPLACE FUNCTION public.sync_conversation_to_deal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_priority text;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  v_new_priority := public.map_priority_chat_to_crm(NEW.priority::text);

  UPDATE public.crm_deals d
     SET assigned_to       = NEW.assigned_to,
         assigned_user_id  = NEW.assigned_user_id,
         priority          = v_new_priority,
         updated_at        = now()
   WHERE (d.custom_fields #>> '{links,chat,conversation_id}') = NEW.id::text
     AND (
       d.assigned_to       IS DISTINCT FROM NEW.assigned_to
       OR d.assigned_user_id IS DISTINCT FROM NEW.assigned_user_id
       OR d.priority::text  IS DISTINCT FROM v_new_priority
     );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_deal_to_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conv_id uuid;
  v_new_priority text;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  v_conv_id := NULLIF(NEW.custom_fields #>> '{links,chat,conversation_id}', '')::uuid;
  IF v_conv_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_new_priority := public.map_priority_crm_to_chat(NEW.priority::text);

  UPDATE public.chat_conversations
     SET assigned_to       = NEW.assigned_to,
         assigned_user_id  = NEW.assigned_user_id,
         priority          = v_new_priority,
         updated_at        = now()
   WHERE id = v_conv_id
     AND (
       assigned_to       IS DISTINCT FROM NEW.assigned_to
       OR assigned_user_id IS DISTINCT FROM NEW.assigned_user_id
       OR priority::text  IS DISTINCT FROM v_new_priority
     );

  RETURN NEW;
END;
$function$;
