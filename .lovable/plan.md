## Objetivo
Gravar **id do usuário** (além do nome) em toda nova ação de `chat_conversation_history`, fazer **backfill** das ~36k linhas antigas e usar o `user_id` como chave canônica em equipe/performance.

## Estado atual
A tabela já tem `user_id`, `from_user_id`, `to_user_id` (bigint) — criados em migrações anteriores. Hoje **nenhuma linha está preenchida**. Alguns write paths já gravam (assign em `ChatHeader` e dois pontos do `WhatsAppDataContext`); a maioria ainda escreve só `actor_name`. A MV `mv_user_chat_daily` já consome esses ids com fallback para nome, então o refresh pós-backfill basta para os agregados.

## 1. Backfill (migração SQL)
Migração única, idempotente (só atualiza linhas com id alvo NULL), sem `ALTER TABLE`. Estratégia em duas passadas, priorizando a fonte mais confiável:

### Passada A — via a própria conversa (preferida)
Usa `chat_conversations.assigned_user_id / assigned_to` da conversa correspondente. Resolve o caso mais comum sem ambiguidade entre tenants.

- `h.user_id`: quando `action ∈ ('resolved','closed','reopened','assigned','tag_added','tag_removed','note_added','snoozed','priority_changed','manual_closed_for_new_conversation','returned_to_queue')` e `lower(btrim(h.actor_name)) = lower(btrim(c.assigned_to))` → copia `c.assigned_user_id`.
- `h.to_user_id`: quando `action = 'assigned'` e `lower(btrim(h.to_value)) = lower(btrim(c.assigned_to))` → copia `c.assigned_user_id`.
- `h.from_user_id`: quando `action ∈ ('returned_to_queue','auto_returned')` e `lower(btrim(coalesce(h.from_value, h.actor_name))) = lower(btrim(c.assigned_to))` → copia `c.assigned_user_id`.

### Passada B — fallback via mapa global `(client_id, nome) → user_id`
Para linhas que sobrarem (ex.: ação posterior à substituição do responsável). O escopo por `client_id` evita match cruzado entre tenants quando o mesmo nome existe em clientes diferentes.

Fonte do mapa: união de
1. `chat_conversations(client_id, assigned_to, assigned_user_id)` onde id não é nulo.
2. `user_activity_log(client_id, user_name, user_id)`.

Agrupa por `(client_id, lower(btrim(name)))` e mantém apenas pares onde **só existe 1 `user_id` distinto** (descarta ambíguos).

Aplica em `user_id`, `to_user_id`, `from_user_id` seguindo os mesmos critérios da passada A.

### Ações de sistema
`actor_name ILIKE 'Sistema%'` ou `'system'` permanecem com `user_id = NULL` por design (assim a MV já as ignora corretamente).

### Refresh
Ao fim: `SELECT public.refresh_team_performance_mvs();` para que os agregados de equipe passem a usar os ids recém-preenchidos.

## 2. Write paths — passar a gravar `user_id`
Pequenos ajustes para adicionar `user_id: user?.id ? Number(user.id) : null` (e `to_user_id`/`from_user_id` quando aplicável), mantendo `actor_name`:

- `src/contexts/WhatsAppDataContext.tsx`: inserts de `opened`, `reopened`, `closed/resolved`, `tag_added`, `tag_removed`, `note_added` (linhas 1037, 1071, 1124, 1278, 1293, 1393). Os de `assigned` (1173, 1631) já estão OK.
- `src/components/chat/SnoozeDialog.tsx` (`snoozed`).
- `src/components/chat/PriorityBadge.tsx` (`priority_changed`).
- `src/components/chat/NewConversationDialog.tsx` (`manual_closed_for_new_conversation`).
- `supabase/functions/chat-bulk-close/index.ts`: aceitar `actor_user_id` no body e gravar em `user_id` (frontend que chama passa a enviar `actor_user_id: user.id`).

Edge functions de webhook (`uazapi-chat-webhook`, `meta-webhook`, `instagram-webhook`, `chat-route-conversation`, `chat-return-chat`) continuam com `actor_name = 'Sistema*'` e `user_id` nulo — coerente.

## 3. Equipe / Performance — usar `user_id`
- `src/pages/equipe/hooks/useTeamPerformance.ts`
  - `mv_user_chat_daily`: trocar o `.or(...)` por `in('user_id', userIds)`. Manter o casamento por nome apenas como tolerância para linhas legacy enquanto a MV não tiver sido refrescada.
  - `useUserConversations`: quando `uid` existir, priorizar `assigned_user_id.eq.<uid>` e dispensar o `ilike` por nome; manter o `ilike` só como fallback quando `uid` é nulo.

## Detalhes técnicos
- Tudo na migração roda em UPDATE com guarda `WHERE h.<col> IS NULL`, então pode ser reexecutada com segurança.
- Não há alteração de schema; índices/colunas já existem.
- Após o refresh, "Recebidas/Concluídas/Devolvidas" do `/equipe` passam a contar por `user_id`, corrigindo divergências causadas por aliases/variações de nome.
- `actor_name` continua sendo gravado (auditoria humana legível).

## Entregáveis
1. `supabase/migrations/<ts>_backfill_chat_conversation_history_user_ids.sql` (passada A + passada B + refresh).
2. Ajustes nos 4 componentes/contexto da seção 2.
3. Atualização em `chat-bulk-close/index.ts` (+ chamadores) para `actor_user_id`.
4. Ajuste em `useTeamPerformance.ts` (MV + `useUserConversations`).
