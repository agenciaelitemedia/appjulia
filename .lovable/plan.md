# Filas: Exclusão sem migração + Restauração para outra fila

## Mudanças solicitadas

1. **Excluir sem migrar**: hoje a fila com conversas ativas exige migrar antes. Adicionar opção "Excluir sem migrar" — as conversas ficam órfãs no soft-delete da fila e podem ser recuperadas depois.
2. **Restaurar para outra fila**: ao restaurar uma fila excluída, permitir mover suas conversas (e mensagens) para uma fila ativa de destino, em vez de só reativar a fila original.
3. **Permissão do botão Excluir**: o item "Excluir" no card da fila só aparece para usuários com role `admin`, `colaborador` ou `user`. Demais roles (`time`, `advogado`, `comercial`) não veem.

---

## Backend — `supabase/functions/queue-management/index.ts`

### Action `delete` (modificar)
- Aceitar novo parâmetro `force: boolean` no body.
- Fluxo atual:
  - Tem agentes vinculados → 409 (mantém).
  - Tem conversas ativas e sem `migrate_to_queue_id` → 409 (mantém).
- Novo: se `force === true` **e** sem `migrate_to_queue_id`:
  - Pular o passo de migração.
  - Prosseguir direto com o soft delete (`is_deleted=true`, `is_active=false`).
  - As conversas/mensagens permanecem com o `queue_id` original (a fila ainda existe, só está marcada como excluída) — isso preserva os dados para uma futura restauração/migração.
- Resposta inclui `forced: true` quando aplicável.

### Action `restore` (modificar)
- Aceitar novo parâmetro opcional `migrate_to_queue_id: string`.
- Comportamento padrão (sem `migrate_to_queue_id`): reativa a fila original (igual hoje).
- Quando `migrate_to_queue_id` é informado:
  1. Validar que a fila destino existe, é do mesmo `client_id` e não está deletada.
  2. `UPDATE chat_conversations SET queue_id = <destino> WHERE queue_id = <fila excluída>`.
  3. `UPDATE chat_messages SET queue_id = <destino> WHERE queue_id = <fila excluída>` (em lotes se necessário).
  4. **Não** reativar a fila excluída — ela permanece com `is_deleted=true` (já não tem mais dados; serve só de histórico).
  - Resposta retorna `migrated_to`, `conversations_moved`, `messages_moved`.

---

## Frontend

### `src/pages/agente/filas/components/DeleteQueueDialog.tsx`
- Adicionar checkbox/switch **"Excluir sem migrar conversas (poderei recuperar depois restaurando para outra fila)"**.
  - Quando ativado: oculta o `Select` de fila destino e libera o botão Excluir mesmo sem destino selecionado.
  - Mostra aviso amarelo: "As N conversas ficarão preservadas até você restaurar/migrar."
- Mantém confirmação por digitação do nome + switch final.
- Hook `useQueueMutations.deleteQueue` ganha o campo `force?: boolean` e repassa ao edge function.

### Novo: `RestoreQueueDialog.tsx` (em `src/pages/agente/filas/components/`)
- Dialog acionado no item "Restaurar" do `QueueCard`.
- Carrega a contagem de conversas/mensagens ainda atreladas à fila excluída (via `chat_conversations` count e `chat_messages` count, server-side).
- Duas opções:
  - **Reativar a fila original** (default): chama `restore` sem `migrate_to_queue_id`.
  - **Restaurar dados em outra fila**: mostra `Select` com filas ativas do mesmo cliente; ao confirmar, chama `restore` com `migrate_to_queue_id`.
- Hook `restoreQueue` aceita objeto `{ queue_id, migrate_to_queue_id? }` (substitui assinatura atual de string).

### `QueueCard.tsx`
- Importar `useAuth` e calcular `canDelete = ['admin','colaborador','user'].includes(user?.role)`.
- O `DropdownMenuItem` "Excluir" só renderiza quando `canDelete` é true.
- Item "Restaurar" agora abre o `RestoreQueueDialog` em vez de chamar `restoreQueue.mutate(id)` direto.

### `FilasPage.tsx`
- Substituir o callback inline `onRestore={(q) => restoreQueue.mutate(q.id)}` por estado `restoreTarget` análogo ao `deleteTarget` e renderizar o `RestoreQueueDialog`.

---

## Notas técnicas

- A coluna `chat_messages.queue_id` é atualizada em batches de até 500 ids para evitar timeouts (padrão já usado no projeto).
- Não mexemos em `queue_agent_links` — restaurar para outra fila não recria vínculos de agentes, apenas move dados de conversa/mensagem.
- A fila origem continua com `is_deleted=true` após uma restauração com migração — fica visível em "Mostrar excluídas" mas vazia.
- Roles: a regra de UI (`admin/colaborador/user`) é só para exibir o botão; o edge function continua validando autenticação como hoje.
