## Objetivo

Quando um membro é removido em `/equipe`, tratar automaticamente as conversas de chat que estavam atribuídas a ele:

- Conversas em **`open`** ou **`pending`** → limpar `assigned_to` (voltam para a fila, sem responsável, prontas para outro atendente pegar).
- Conversas em **`resolved`** → mover para **`closed`** (definir `status = 'closed'` e `closed_at = now()`), mantendo `assigned_to` histórico.
- Conversas já **`closed`** → não mexer.
- Registrar entrada em `chat_conversation_history` de cada conversa afetada para rastreabilidade.

## Contexto técnico

- `chat_conversations.assigned_to` guarda o **nome** do membro (ver `useChatAssignedCountsByMember`, `useAssigneeNameResolver`). O identificador para casar as conversas é o `name` do usuário removido, não o `id`.
- Hoje a exclusão passa por `useDeleteTeamMember` → `externalDb.deleteTeamMember(memberId)` → action `delete_team_member` da edge `db-query` (banco externo). Essa edge só mexe em `user_agents` e `users`; não toca em Supabase.
- Precisamos de um passo adicional no Supabase, executado **antes** da exclusão no banco externo, para evitar deixar registros órfãos caso a exclusão falhe (FK). Se a exclusão externa falhar (`fk_violation`), como o membro continua existindo, o efeito colateral no Supabase é indesejado — por isso o passo Supabase roda **depois** da exclusão externa ter retornado `success: true`.

## Mudanças

### 1. Nova Edge Function `team-member-cleanup-conversations`
- Input: `{ clientId: string, memberName: string, memberId: number, actorName?: string }`.
- Usa `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS) escopado por `client_id`.
- Passos:
  1. `SELECT id, status, assigned_to FROM chat_conversations WHERE client_id = $1 AND assigned_to = $2` (comparação case-insensitive/trim para robustez).
  2. Para `status IN ('open','pending')`: `UPDATE ... SET assigned_to = NULL, updated_at = now()`.
  3. Para `status = 'resolved'`: `UPDATE ... SET status = 'closed', closed_at = COALESCE(closed_at, now()), updated_at = now()`.
  4. Inserir uma linha em `chat_conversation_history` por conversa (`action = 'member_removed_cleanup'`, `from_value = memberName`, `to_value = novo status`, `actor_name = actorName || 'Sistema'`, `notes = 'Membro removido da equipe'`).
- Retorno: `{ unassigned: number, closed: number }`.

### 2. `src/pages/equipe/hooks/useEquipeData.ts` — `useDeleteTeamMember`
- Antes de chamar `externalDb.deleteTeamMember`, capturar `name` e `client_id` do membro a partir da lista já carregada (`useTeamMembers` cache) ou de uma consulta rápida.
- Após `externalDb.deleteTeamMember` retornar sucesso, invocar a nova edge via `supabase.functions.invoke('team-member-cleanup-conversations', { body: { clientId, memberName, memberId, actorName: user?.name } })`.
- Se a edge falhar, exibir toast de aviso (não reverter a exclusão — o usuário já foi removido). Toast de sucesso passa a mostrar contagens: "Membro removido. X conversas devolvidas à fila, Y encerradas.".
- Invalidar queries: `['team-members']`, `['chat-assigned-counts-by-member']`, `['chat-conversations']` (o que já existir de chat).

### 3. Diálogo `DeleteMemberDialog.tsx`
- Adicionar aviso no corpo: "Conversas em aberto/pendentes atribuídas a este membro voltarão para a fila (sem responsável). Conversas resolvidas serão encerradas."

## Não muda

- Nada na tabela `users` do banco externo além do que já é feito.
- `chat_conversation_participants` (observadores), `chat_mentions`, `chat_conversation_history` antigo, notas do CRM: não são alterados — o nome do ex-membro fica preservado no histórico.
- Regras de RLS de `chat_conversations` (a edge usa service role).

## Validação

- Build limpo.
- Teste manual: criar membro fake, atribuir 1 conversa open + 1 pending + 1 resolved + 1 closed, remover o membro, conferir no banco:
  - open/pending → `assigned_to IS NULL`.
  - resolved → `status = 'closed'`, `closed_at` preenchido.
  - closed → intacto.
  - `chat_conversation_history` com 3 novas linhas `member_removed_cleanup`.
- Conferir toast e badges de contadores atualizados.
