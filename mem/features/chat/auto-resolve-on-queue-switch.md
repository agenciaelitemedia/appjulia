---
name: Auto-resolve prior queue conversations
description: Quando contato entra em fila nova, conversas ativas em outras filas são auto-resolved sem alterar updated_at (preserva leader = conversa ativa)
type: feature
---

Trigger `trg_auto_resolve_prior_queue_conversations` em `chat_conversations` (AFTER INSERT/UPDATE OF status, queue_id, contact_id).
Função `public.auto_resolve_prior_queue_conversations`:
- Quando uma conversa fica/é criada como pending/open para (contact_id, client_id, channel), marca as outras conversas pending/open do mesmo contato em filas DIFERENTES como `resolved` (+ `resolved_at = now()`, close_note `[auto] ...`).
- CRÍTICO: NÃO atualiza `updated_at` da conversa antiga (preserva o valor anterior). Sem isso, a conversa recém-fechada ficaria como leader em `useContactLatestConversation`, divergindo do card mostrado em `ChatList` (que usa apenas conversas ativas).
- Insere `chat_conversation_history` com `action='auto_resolved_queue_switch'`.

Frontend pareado: `selectedConversation` no `WhatsAppDataContext` prioriza conversa pending/open do contato quando o filtro de status é ativo, garantindo que clicar no card abra a mesma fila exibida.
