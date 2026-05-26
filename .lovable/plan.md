## Otimização da busca no chat (nome / telefone)

### Diagnóstico

A busca da lista de conversas (`ChatList`) filtra `chat_contacts` com:
```
client_id = X AND (name ILIKE '%term%' OR phone ILIKE '%digits%')
```

Hoje a tabela tem índices btree em `phone`, `client_id`, `last_message_at`, etc., mas **nenhum índice serve para `ILIKE '%...%'` (wildcard à esquerda)**. Resultado: cada busca faz seq scan na `chat_contacts` inteira do cliente.

Em contrapartida, `chat_messages` já tem `gin_trgm_ops` em `text` e `caption` — ou seja, a extensão `pg_trgm` já está habilitada e o padrão a seguir está validado no projeto.

### O que vou fazer

Criar uma migration adicionando índices GIN trigram em `chat_contacts`, replicando o padrão já usado em `chat_messages`:

1. `idx_chat_contacts_name_trgm` — GIN em `name gin_trgm_ops` (acelera `name ILIKE '%...%'`).
2. `idx_chat_contacts_phone_trgm` — GIN em `phone gin_trgm_ops` (acelera `phone ILIKE '%digits%'`).
3. Índice composto `idx_chat_contacts_client_lastmsg_isgroup` em `(client_id, is_group, last_message_at DESC NULLS LAST)` — cobre o caso de listagem por aba Individual/Grupos sem busca, evitando dois passos (já existe `client_lastmsg`, mas sem o `is_group` que o `useContactsList` filtra).

Todos `CREATE INDEX IF NOT EXISTS` para serem seguros / reexecutáveis. Sem `CONCURRENTLY` porque a migration roda em transação no Supabase.

### Por que não mexer em mais nada

- `chat_messages` já tem trigram em `text`/`caption` (usado pelo `ChatSearchDialog`).
- `chat_conversations` já tem índices para `client_id + status + updated_at` (paginação) e `protocol`.
- A query da busca já filtra por `client_id` primeiro, então o GIN trigram entra como filtro adicional rápido — não precisa de índice parcial por cliente.

### Detalhes técnicos

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_chat_contacts_name_trgm
  ON public.chat_contacts USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_chat_contacts_phone_trgm
  ON public.chat_contacts USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_chat_contacts_client_isgroup_lastmsg
  ON public.chat_contacts (client_id, is_group, last_message_at DESC NULLS LAST);
```

Sem alteração de código frontend — a query atual passa a usar os novos índices automaticamente.
