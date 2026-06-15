# Fix: trigger quebrado bloqueando criação de conversas

## Causa raiz

A função `inherit_open_ticket_on_new_conversation()` referencia `support_tickets.client_id`, mas essa coluna não existe — o nome real é `requester_client_id`. Como o trigger roda em `AFTER INSERT` em `chat_conversations`, todo INSERT de conversa falha desde 15/06 14:14 (instalação do trigger). Mensagens continuam sendo inseridas mas com `conversation_id = NULL`.

Sintoma: **117 mensagens órfãs hoje só no cliente 196**, em 5 contatos. Bug é global (afeta todos os clientes desde 14:14 BRT).

## Etapa 1 — Corrigir o trigger (migração SQL)

Recriar `public.inherit_open_ticket_on_new_conversation()` trocando `client_id` por `requester_client_id`:

```sql
CREATE OR REPLACE FUNCTION public.inherit_open_ticket_on_new_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_open_statuses constant text[] := ARRAY['open','pending','in_progress','waiting_customer'];
  v_ticket record;
BEGIN
  IF NEW.contact_id IS NULL OR NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, number, protocol
    INTO v_ticket
    FROM public.support_tickets
   WHERE contact_id = NEW.contact_id
     AND requester_client_id = NEW.client_id          -- ✅ corrigido
     AND status = ANY (v_open_statuses)
     AND (conversation_id IS NULL OR conversation_id <> NEW.id)
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.support_tickets
     SET conversation_id = NEW.id,
         updated_at = now()
   WHERE id = v_ticket.id;

  RETURN NEW;
END;
$$;
```

## Etapa 2 — Backfill das mensagens órfãs (mesma migração)

Para cada `(contact_id, client_id, queue_id, channel)` distinto que tem mensagens com `conversation_id IS NULL` desde 15/06 14:00:

1. Verificar se já existe conversa ativa para o contato/fila/canal — se sim, vincular as mensagens órfãs a ela.
2. Caso contrário, criar uma nova `chat_conversations` (status `pending`, `metadata = {recovered_orphan: true}`) e atribuir todas as mensagens órfãs a ela. Como o trigger já estará corrigido, o INSERT vai funcionar.
3. Inserir um registro em `chat_conversation_history` com `action='recovered'`.

A migração faz isso em uma CTE/loop limitado para evitar timeout, escopo global (todos clientes afetados).

## Etapa 3 — Validação

Após a migração, conferir:
- `SELECT COUNT(*) FROM chat_messages WHERE conversation_id IS NULL AND created_at >= '2026-06-15 14:00'` → deve cair para 0 ou perto.
- Criar manualmente uma conversa de teste para garantir que o trigger não quebra mais.
- Verificar nos logs de edge function que novos webhooks param de gerar mensagens órfãs.

## Notas técnicas

- O trigger `sync_conversation_active_ticket` (em `support_tickets`) usa as colunas certas e continua intacto.
- Não há alteração de schema, apenas redefinição de função + UPDATE em dados.
- Não vamos mexer em `support_tickets` nem em outras triggers.
