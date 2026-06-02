---
name: Auto-resolve prior queue conversations
description: Trigger que resolve conversas ativas anteriores do mesmo contato em outras filas ao iniciar atendimento em uma nova fila
type: feature
---

Trigger `trg_auto_resolve_prior_queue_conversations` em `chat_conversations` (AFTER INSERT/UPDATE OF status, queue_id, contact_id), função `auto_resolve_prior_queue_conversations`:

- Quando uma conversa fica `pending`/`open` em uma `queue_id`, todas as demais conversas do mesmo `contact_id` + `client_id` + `channel` que estejam `pending`/`open` em **outras** `queue_id` são automaticamente marcadas como `resolved` (`resolved_at = now()`, close_note com prefixo `[auto]`).
- Cada resolução automática insere um registro em `chat_conversation_history` com `action = 'auto_resolved_queue_switch'`.
- Garante que o lead apareça em apenas uma fila/atendente ativo por vez (evita duplicação na lista "Meus Atendimentos").
- Mesmo canal apenas: tickets em canais diferentes (ex.: WABA vs UaZapi) continuam coexistindo conforme `ticket-channel-isolation`.
- Reabertura via `conversation-reopen-rules` segue funcionando: ao reabrir resolved, o trigger dispara e resolve outras filas anteriores que ainda estejam abertas.