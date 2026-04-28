## Objetivo

Quando uma fila for **soft-deletada** (`queues.is_deleted=true`), todas as conversas e mensagens vinculadas a ela devem **sumir** do Chat e dos vínculos com o CRM. Só voltam a aparecer se forem migradas para uma fila ativa (via "Restaurar com Migração").

## Diagnóstico

Hoje a UI filtra apenas por `queue_id` quando o usuário escolhe uma fila no topo. Quando nenhuma fila está selecionada (ou o filtro está em "todas"), as queries em `chat_conversations` carregam tudo do `client_id` — **inclusive registros cuja fila está com `is_deleted=true`**. O mesmo vale para:

- Carregamento de conversas (`WhatsAppDataContext.loadConversations` / `loadConvCounts`)
- Realtime (`chat_conversations_changes`)
- Vínculos CRM (`useChatCRMLinks` lista `chat_crm_links` sem checar a fila da conversa)
- Hooks do CRM Builder que resolvem conversa por contato/deal (`useDealConversation`, `useContactConversation`, `useChatContactConversationStatus`, `useCardLinks`)
- `WhatsAppMessagesDialog` no CRM
- Edge functions que buscam "conversa ativa" (rota/IA/automação) — devem ignorar fila excluída para não recriar tickets fantasmas

A solução é filtrar por `queue_id` que pertença a uma fila NÃO-deletada em todos esses pontos.

## Mudanças

### 1. Banco — view auxiliar (migration)

Criar uma view `public.active_queue_ids` (ou função `is_queue_active(uuid)`) que devolve apenas filas com `is_deleted=false`. Usaremos para filtros via `.in('queue_id', ...)` quando precisarmos restringir no client.

```sql
CREATE OR REPLACE VIEW public.active_queue_ids AS
SELECT id FROM public.queues WHERE is_deleted = false;
```

### 2. Frontend — Chat (`src/contexts/WhatsAppDataContext.tsx`)

- `loadConversations`, `loadConvCounts`, `loadHistoryConversations` (qualquer query em `chat_conversations`): adicionar filtro `.in('queue_id', activeQueueIds)` quando `currentQueueId` não estiver definido. Quando `currentQueueId` está definido, manter o filtro atual (já é uma fila explícita; se ela estiver deletada não aparece no seletor).
- Resolução do "queue da conversa anterior" (`getOrCreateConversation`): ignorar conversas cuja `queue_id` esteja em fila deletada.
- Realtime: no handler do `postgres_changes`, descartar eventos cujo `queue_id` não esteja em `activeQueueIds`.
- `activeQueueIds` virá do hook `useAccessibleQueues(false)` (já carrega só não-deletadas) — basta materializar `useMemo(() => new Set(allQueues.map(q => q.id)), [allQueues])` e usar em filtro `.in()` ou em filtro client-side.

### 3. Frontend — CRM Builder e CRM

- `src/hooks/useChatCRMLinks.ts`: ao listar `chat_crm_links`, fazer join lógico com `chat_conversations(queue_id)` e descartar links cuja conversa esteja em fila deletada. Implementação: `select('*, chat_conversations:conversation_id(queue_id, queues:queue_id(is_deleted))')` e filtrar no client (ou criar view `chat_crm_links_active`).
- `src/pages/crm-builder/hooks/useDealConversation.ts`, `useContactConversation.ts`, `useChatContactConversationStatus.ts`, `useCardLinks.ts`: ao buscar a "conversa ativa" do contato, juntar com `queues` e ignorar `is_deleted=true`.
- `src/pages/crm/components/WhatsAppMessagesDialog.tsx`: idem — não exibir mensagens cuja conversa pertença a fila deletada.

### 4. Edge Functions (rota/automação/IA)

Atualizar buscas por "conversa existente" para não reaproveitar conversas de filas deletadas (caso contrário, mensagens novas iriam parar numa conversa "invisível"):

- `supabase/functions/chat-route-conversation/index.ts`
- `supabase/functions/chat-ai-process/index.ts`
- `supabase/functions/chat-automation-engine/index.ts`
- `supabase/functions/uazapi-chat-webhook/index.ts`
- `supabase/functions/meta-webhook/index.ts`
- `supabase/functions/instagram-webhook/index.ts`
- `supabase/functions/webchat-api/index.ts`

Padrão: ao fazer `from('chat_conversations').select(...).eq('contact_id', ...)`, adicionar join `queues!inner(is_deleted)` e filtrar `is_deleted=false`. Se a única conversa existente estiver em fila deletada, criar uma nova conversa numa fila ativa (a lógica de resolução de fila já existe no contexto).

### 5. Restauração com migração (já existe)

Nenhuma mudança necessária — `queue-management` action `restore` com `migrate_to_queue_id` move `chat_conversations.queue_id` para a fila ativa, então as conversas/mensagens reaparecem automaticamente assim que esses filtros considerarem fila ativa.

## Resultado esperado

- Excluir uma fila → conversas e mensagens dessa fila somem imediatamente do Chat e dos vínculos CRM.
- Mensagens novas que cheguem para um contato cuja última conversa estava na fila excluída criam uma nova conversa em fila ativa (não revivem a conversa órfã).
- Restaurar a fila com migração → conversas e mensagens reaparecem na fila destino.
- Restaurar a fila sem migração (reativar a original) → conversas e mensagens reaparecem na fila original.
- Nenhum dado é apagado de fato; o efeito é só de visibilidade controlada pelo `is_deleted` da fila.