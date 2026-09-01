-- 1) Identificador canônico do responsável de uma conversa
CREATE OR REPLACE FUNCTION public.chat_resolve_assignee_identifier(
  p_client_id text,
  p_assigned_user_id bigint,
  p_assigned_to text
) RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_assigned_user_id IS NOT NULL THEN p_assigned_user_id::text
    WHEN p_assigned_to ~ '^[0-9]+$' THEN p_assigned_to
    WHEN p_assigned_to IS NULL OR btrim(p_assigned_to) = '' THEN NULL
    ELSE (
      SELECT c.agent_identifier
      FROM public.chat_agent_capacity c
      WHERE c.client_id = p_client_id
        AND lower(btrim(c.agent_name)) = lower(btrim(p_assigned_to))
      ORDER BY c.updated_at DESC NULLS LAST
      LIMIT 1
    )
  END
$$;

-- 2) Carga real por atendente (conversas open/pending)
CREATE OR REPLACE FUNCTION public.chat_agent_live_load(p_client_id text)
RETURNS TABLE (agent_identifier text, load integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT ident AS agent_identifier, count(*)::int AS load
  FROM (
    SELECT public.chat_resolve_assignee_identifier(
             conv.client_id, conv.assigned_user_id, conv.assigned_to
           ) AS ident
    FROM public.chat_conversations conv
    WHERE conv.client_id = p_client_id
      AND conv.status IN ('open', 'pending')
      AND (conv.assigned_user_id IS NOT NULL OR btrim(coalesce(conv.assigned_to, '')) <> '')
  ) s
  WHERE ident IS NOT NULL
  GROUP BY ident
$$;

-- 3) Verificação de capacidade (regra única de decisão)
CREATE OR REPLACE FUNCTION public.chat_capacity_check(
  p_client_id text,
  p_agent_identifier text
)
RETURNS TABLE (
  agent_identifier text,
  agent_name text,
  load integer,
  max_concurrent integer,
  blocked boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH cap AS (
    SELECT c.agent_name, coalesce(c.max_concurrent, 20) AS max_concurrent, c.is_active
    FROM public.chat_agent_capacity c
    WHERE c.client_id = p_client_id
      AND c.agent_identifier = p_agent_identifier
    LIMIT 1
  ), lv AS (
    SELECT coalesce((SELECT l.load FROM public.chat_agent_live_load(p_client_id) l
                     WHERE l.agent_identifier = p_agent_identifier), 0) AS load
  )
  SELECT
    p_agent_identifier,
    (SELECT agent_name FROM cap),
    (SELECT load FROM lv),
    coalesce((SELECT max_concurrent FROM cap), 20),
    (SELECT load FROM lv) >= coalesce((SELECT max_concurrent FROM cap), 20)
$$;

-- 4) Espelho de current_load na tabela de capacidade
CREATE OR REPLACE FUNCTION public.chat_sync_agent_load(p_client_id text, p_agent_identifier text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_client_id IS NULL OR p_agent_identifier IS NULL THEN RETURN; END IF;
  UPDATE public.chat_agent_capacity c
     SET current_load = coalesce((
           SELECT l.load FROM public.chat_agent_live_load(p_client_id) l
           WHERE l.agent_identifier = p_agent_identifier
         ), 0),
         updated_at = now()
   WHERE c.client_id = p_client_id
     AND c.agent_identifier = p_agent_identifier;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_conversations_sync_agent_load()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_ident text;
  new_ident text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_ident := public.chat_resolve_assignee_identifier(OLD.client_id, OLD.assigned_user_id, OLD.assigned_to);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_ident := public.chat_resolve_assignee_identifier(NEW.client_id, NEW.assigned_user_id, NEW.assigned_to);
  END IF;

  IF old_ident IS NOT NULL THEN
    PERFORM public.chat_sync_agent_load(OLD.client_id, old_ident);
  END IF;
  IF new_ident IS NOT NULL AND (old_ident IS NULL OR new_ident <> old_ident OR TG_OP = 'UPDATE') THEN
    PERFORM public.chat_sync_agent_load(NEW.client_id, new_ident);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_conversations_sync_agent_load ON public.chat_conversations;
CREATE TRIGGER trg_chat_conversations_sync_agent_load
AFTER INSERT OR DELETE ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.chat_conversations_sync_agent_load();

DROP TRIGGER IF EXISTS trg_chat_conversations_sync_agent_load_upd ON public.chat_conversations;
CREATE TRIGGER trg_chat_conversations_sync_agent_load_upd
AFTER UPDATE OF assigned_to, assigned_user_id, status, client_id ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.chat_conversations_sync_agent_load();

-- 5) Limite padrão 20 para novos registros de capacidade
ALTER TABLE public.chat_agent_capacity ALTER COLUMN max_concurrent SET DEFAULT 20;

GRANT EXECUTE ON FUNCTION public.chat_agent_live_load(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chat_capacity_check(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chat_resolve_assignee_identifier(text, bigint, text) TO anon, authenticated, service_role;