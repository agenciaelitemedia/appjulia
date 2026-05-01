---
name: Conversation Reopen Rules
description: Regra unificada de reabertura/criação de conversas (tickets) ao chegar nova mensagem inbound nos webhooks de canais (UaZapi, WABA, Instagram).
type: feature
---

Quando uma nova mensagem **inbound** (`fromMe = false`) chega via webhook de canal:

1. Existe conversa `pending` ou `open` para (contact + client + queue + channel) → anexa.
2. Existe conversa `resolved` (mais recente) → **reabre** essa mesma conversa:
   - `status = 'open'`, `resolved_at = null`, `updated_at = now()`.
   - **NÃO altera `assigned_to`** — mesmo agente que resolveu permanece responsável.
   - Insere `chat_conversation_history` com `action = 'reopened'`.
3. Não há ativa nem resolved (somente `closed` ou nenhuma) → **cria nova**:
   - `status = 'pending'`, `assigned_to = null` (volta para a fila pendente sem dono).
   - Insere `chat_conversation_history` com `action = 'opened'`.

Mensagens **outbound** (ecos `fromMe = true`) apenas anexam à conversa ativa; nunca disparam reopen nem criação.

**Diferença `resolved` vs `closed`:**
- `resolved` = encerramento leve, cliente pode voltar e retoma o ticket com o mesmo dono.
- `closed` = encerramento definitivo, próxima mensagem é ticket NOVO sem atribuição.

**Arquivos que implementam a regra:**
- `supabase/functions/uazapi-chat-webhook/index.ts` (~linha 1140)
- `supabase/functions/meta-webhook/index.ts` (~linha 222)
- `supabase/functions/instagram-webhook/index.ts` (~linha 121)

`webchat-api` está fora deste padrão: cada sessão de visitante cria uma conversa nova por design.
