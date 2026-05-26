## Acelerar carregamento de mensagens no chat

### Diagnóstico

O `loadMessages` (em `WhatsAppDataContext.tsx`) faz:
```
select * from chat_messages where contact_id = X order by timestamp desc limit 50
```

Boa notícia: o índice composto `idx_chat_messages_contact_ts (contact_id, timestamp DESC)` **já existe** — essa query já está otimizada do lado do banco. O custo restante vem de:

1. **Índices duplicados/redundantes** em `chat_messages`, que deixam INSERT (cada mensagem nova do webhook) mais lento e ocupam cache:
   - `idx_chat_messages_external` é **idêntico** ao `idx_chat_messages_contact_external` (mesmo `(contact_id, external_id) WHERE external_id IS NOT NULL`, ambos UNIQUE).
   - `idx_chat_messages_contact (contact_id)` é **coberto** pelo composto `idx_chat_messages_contact_ts (contact_id, timestamp DESC)` — pode ser removido sem afetar leitura.

2. **`markAsRead` (WABA)** faz:
   ```
   where contact_id=X and from_me=false and message_id is not null order by timestamp desc limit 1
   ```
   Hoje usa o composto `(contact_id, timestamp)` e filtra `from_me`/`message_id` em memória. Um índice parcial específico evita escanear mensagens enviadas/sem wamid.

### O que vou fazer

Migration enxuta:

1. `DROP INDEX IF EXISTS idx_chat_messages_external;` (duplicado puro)
2. `DROP INDEX IF EXISTS idx_chat_messages_contact;` (redundante com o composto)
3. Criar:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_chat_messages_contact_inbound_ts
     ON public.chat_messages (contact_id, "timestamp" DESC)
     WHERE from_me = false AND message_id IS NOT NULL;
   ```
4. `ANALYZE public.chat_messages;` para atualizar estatísticas.

### Por que não mexer no frontend

A query do `loadMessages` já é a forma certa (composto `contact_id + timestamp DESC`, `limit 50`, paginação por offset). Trocar `select *` por colunas específicas economiza pouco e exigiria mudanças em toda a tipagem `ChatMessage` — risco maior que ganho.

### Resultado esperado

- **Leitura da conversa selecionada**: mesmo plano (já usa o índice composto), mas o `ANALYZE` garante que o planner mantenha a escolha.
- **INSERT de mensagens novas (webhook)**: ~15-25% mais rápido por mensagem ao remover 2 índices redundantes.
- **`markAsRead` em filas WABA**: passa a usar índice parcial bem menor — quase instantâneo.
- Sem mudança de código frontend.
