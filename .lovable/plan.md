## Causa raiz

`chat_conversations.assigned_user_id` está chegando `NULL` em **auto-atribuições** porque os caminhos de atribuição automática só preenchem a coluna textual `assigned_to`. A coluna numérica `assigned_user_id` (usada por `mv_user_chat_daily` e pelo dashboard de Performance) nunca é populada nesses fluxos.

Levantamento na base (criadas desde 15/06): **39 conversas têm `assigned_to` preenchido mas `assigned_user_id` NULL**. Os valores em `assigned_to` confirmam o padrão: misturam nome ("Emerson", "ADRIELE", "Ana Carolina Marques") e user_id textual ("315", "227") — exatamente o que cada caller grava.

### Callers que gravam `assigned_to` sem `assigned_user_id`

| # | Arquivo | Linha | Origem do valor |
|---|---|---|---|
| 1 | `supabase/functions/chat-route-conversation/index.ts` | 263-269 | `agent` = user_id do `agent_pool` (string numérica) |
| 2 | `supabase/functions/chat-automation-engine/index.ts` | 184 | `cfg.assigned_to` (livre) |
| 3 | `supabase/functions/chat-public-api/index.ts` | 141 | `body.assigned_to` (livre) |
| 4 | `src/components/chat/NewConversationDialog.tsx` | 241 | `currentUser.name` ou `String(currentUser.id)` |
| 5 | `src/components/chat/ChatTicketSidePanel.tsx` | 141 | `String(assignedMember.id)` |

O único caller correto hoje é `WhatsAppDataContext.sendMessage` (linha 1626-1631), que já preenche os dois campos.

### Por que impacta o dashboard 18/06

`useTeamPerformance` agora não filtra mais por `user_id` em `mv_user_chat_daily` (correção da última iteração), mas o **fallback por nome** depende de `assigned_to === user.name`. Quando o auto-roteador grava `assigned_to = "315"` (user_id como string) ou um nome diferente do `users.name`, o lead não cola em nenhum atendente — e some das colunas Recebidos / Resolvidos / Devolvidos.

---

## Plano de correção

Preencher `assigned_user_id` em **todos** os fluxos de atribuição automática, normalizando a partir do `assigned_to` quando ele já é numérico, ou resolvendo via `users` quando vier nome.

### 1. `chat-route-conversation` (principal fluxo automático)
- Após escolher `agent` em `pickAgent`, fazer `Number(agent)` e gravar `assigned_user_id` quando `Number.isFinite`.
- Buscar `users.name` (1 query) para gravar `assigned_to = name` (legível) em vez do user_id textual.
- Incluir `to_user_id` e `user_id` no insert de `chat_conversation_history` da ação `auto_routed`.

### 2. `chat-automation-engine` (ação `auto_assign`)
- Aceitar `cfg.assigned_to` numérico ou textual.
- Se numérico: gravar `assigned_user_id` e resolver `name` via `users` para `assigned_to`.
- Se textual: tentar resolver `user_id` via `users.name` (case-insensitive); se achar, popular `assigned_user_id`.

### 3. `chat-public-api` (action `assign`)
- Mesmo tratamento do item 2 quando `body.assigned_to` é informado.

### 4. `NewConversationDialog.tsx` e `ChatTicketSidePanel.tsx`
- Já possuem o `user.id` / `assignedMember.id` numérico em mãos. Adicionar `assigned_user_id: Number(id)` ao update/insert.

### 5. Backfill pontual (uma vez)
Migration para corrigir as conversas órfãs já gravadas:

```text
UPDATE chat_conversations c
   SET assigned_user_id = u.id
  FROM users u
 WHERE c.assigned_user_id IS NULL
   AND c.assigned_to IS NOT NULL
   AND (
         c.assigned_to ~ '^[0-9]+$' AND u.id = c.assigned_to::bigint
      OR lower(trim(u.name)) = lower(trim(c.assigned_to))
   );
```
Limitar via `WHERE c.updated_at >= now() - interval '30 days'` para não tocar histórico antigo.

### Fora de escopo
- Mudar o tipo de `assigned_to` para numérico (quebra muitos consumidores).
- Refatorar a UX dos seletores de atendente.
- Alterar `useTeamPerformance` — já está correto após a última iteração; a correção é nos pontos de gravação.

---

## Como verificar depois

1. Rodar `SELECT count(*) FROM chat_conversations WHERE assigned_to <> '' AND assigned_user_id IS NULL AND created_at >= now() - interval '7 days'` → deve cair para zero em novas atribuições.
2. Abrir Performance / Equipe e conferir as colunas Recebidos / Resolvidos / Devolvidos para 18/06 e dias seguintes — devem refletir as auto-atribuições do `chat-route-conversation`.
