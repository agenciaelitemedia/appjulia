---
name: Conversation Reopen Rules
description: Regra unificada de reabertura/criação de conversas (tickets) ao chegar nova mensagem inbound nos webhooks de canais (UaZapi, WABA, Instagram).
type: feature
---

Quando uma nova mensagem **inbound** (`fromMe = false`) chega via webhook de canal:

1. Existe conversa `pending` ou `open` para (contact + client + queue + channel) → anexa.
2. Existe conversa `resolved` (mais recente, mesmo `contact_id` + `client_id` + `channel`) → **reabre**:
   - `resolved_at = null`, `updated_at = now()`.
   - **Status efetivo depende do `assigned_to` atual:**
     - `assigned_to` preenchido → `status = 'open'` (mantém responsável original).
     - `assigned_to` vazio (ex.: foi limpo por `auto_returned` antes do `resolved`) → `status = 'pending'` — volta para a fila aguardando atendimento.
   - **NÃO reatribui** — apenas respeita o `assigned_to` corrente.
   - Se a `queue_id` da nova mensagem for diferente da antiga, atualiza `queue_id` (mensagem chegou em outra fila do mesmo canal).
   - Insere `chat_conversation_history` com `action = 'reopened'`.
   - **Importante**: o lookup do `resolved` IGNORA `queue_id` (só amarra por canal). Isso evita duplicar ticket quando a fila do contato muda.
3. Não há ativa nem resolved (somente `closed` ou nenhuma) → **cria nova**:
   - `status = 'pending'`, `assigned_to = null` (volta para a fila pendente sem dono).
   - Insere `chat_conversation_history` com `action = 'opened'`.

**Regra invariante para a lista de chat (defense-in-depth):**
- `status = 'open'` exige `assigned_to` preenchido. Se algum ticket aparecer como `open` sem dono, a UI o reclassifica como `pending` na aba "Aguardando atendimento" (`ChatList.tsx` e `WhatsAppDataContext.tsx` aplicam essa regra). O frontend (`getOrCreateConversation` e o envio da primeira resposta) também garante atribuir o usuário ao promover `pending → open`.

Mensagens **outbound** (ecos `fromMe = true`) apenas anexam à conversa ativa; nunca disparam reopen nem criação.

**Diferença `resolved` vs `closed`:**
- `resolved` = encerramento leve, cliente pode voltar e retoma o ticket com o mesmo dono.
- `closed` = encerramento definitivo, próxima mensagem é ticket NOVO sem atribuição.

**Arquivos que implementam a regra:**
- `supabase/functions/uazapi-chat-webhook/index.ts` (~linha 1140)
- `supabase/functions/meta-webhook/index.ts` (~linha 222)
- `supabase/functions/instagram-webhook/index.ts` (~linha 121)

`webchat-api` está fora deste padrão: cada sessão de visitante cria uma conversa nova por design.

**UI / Realtime (frontend):**
O handler do canal realtime `chat_conversations_changes` em `src/contexts/WhatsAppDataContext.tsx` faz **upsert/remove conforme o filtro de status ativo** (`active` = pending+open, `resolved`, `closed`), lendo o filtro via `convQueryGroupRef`. Sem isso, conversas reabertas (resolved → open) não apareceriam na aba "Em aberto" sem reload, porque elas não foram carregadas inicialmente naquele grupo. **NÃO voltar para `prev.map(...)` puro.**
