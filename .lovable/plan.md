## Objetivo
Reforçar as validações de permissão (Criar / Editar / Remover / Mover) no CRM Builder, garantindo que **toda ação passe pelo gate** de `useEffectiveBoardPermission` e que o usuário receba **feedback visível** quando a ação for negada.

## Estado atual (verificado)
- `BoardPage.tsx` já lê `canView/canCreate/canEdit/canDelete` e gateia:
  - Entrada do quadro (`canView`)
  - `handleDragStart / handleDragOver / handleDragEnd` (checam `canEditDeal` e retornam cedo)
  - `handleCreateDeal / handleEditDeal / handleAddDeal`
  - Botões de status, prioridade, arquivar, mover para stage/board no `DealDetailsSheet`
- `DealCard` recebe `canEdit / canDelete / canDrag` e esconde itens do menu.
- `PipelineColumn` recebe `canCreateDeal` e esconde "Adicionar Card" no menu do dropdown.
- `useCRMBoards` filtra a listagem por `can_view`.

## Gaps encontrados
1. **Silenciosos**: quando a permissão nega, os handlers só fazem `return` sem toast — usuário não entende por que o clique não faz nada.
2. **Rodapé do `PipelineColumn`**: o botão "Adicionar Card" no rodapé (fora do dropdown) não respeita `canCreateDeal` — só o item do menu é escondido.
3. **`onChangePriority`, `onArchive`, `onWon`, `onLost`** em `BoardPage` fazem `canX && action()` — se negado, nada acontece e nenhum toast é emitido.
4. **Camada de hook (`useCRMDeals`)**: `createDeal/updateDeal/moveDeal/archiveDeal/setDealStatus` não têm defense-in-depth. Se algum call site novo esquecer de gateiar, a ação passa direto para o banco (lembrando que a RLS do projeto é permissiva, conforme project-knowledge).

## Plano

### 1. Feedback visível ao negar (`BoardPage.tsx`)
Criar um helper local:
```ts
const denyToast = (msg = 'Você não tem permissão para esta ação') => toast.error(msg);
```
Aplicar em:
- `handleDragStart` / `handleDragOver` / `handleDragEnd` quando `!canEditDeal` → `denyToast('Sem permissão para mover cards')`
- `handleAddDeal` / `handleCreateDeal` quando `!canCreateDeal` → `denyToast('Sem permissão para criar cards')`
- `handleEditDeal` e callbacks inline (`onChangePriority`, `onWon`, `onLost`, `onUpdate`, `onMoveToStage`, `onMoveToBoard`) quando `!canEditDeal` → `denyToast('Sem permissão para editar cards')`
- `onArchive` quando `!canDeleteDeal` → `denyToast('Sem permissão para remover cards')`

### 2. Esconder o botão "Adicionar Card" do rodapé (`PipelineColumn.tsx`)
Envolver o `<Button>` de "Adicionar Card" (rodapé, linhas ~231-241) em `{canCreateDeal && (...)}` — mesmo padrão já usado no item do dropdown.

### 3. Defense-in-depth no hook (`useCRMDeals.ts`)
Nas mutações `createDeal / updateDeal / moveDeal / setDealStatus / archiveDeal`, no início de cada uma, consultar as regras vigentes para o `board_id` do deal e checar o modo/permissão do usuário atual antes do write. Se negado:
- `toast.error('Sem permissão...')`
- retornar `false` / `null`

Implementação: pequena função `assertBoardPermission(boardId, action)` no próprio hook, que reusa a lógica de `useEffectiveBoardPermission` (extraída para um util puro `computeEffectivePermission(rules, mode, user)` em `useCRMBoardPermissions.ts` para não duplicar).

### 4. Verificação
- Rodar preview e testar como usuário sem permissão: cliques em criar/editar/remover/arrastar mostram toast e não persistem.
- Owner/admin continua com acesso total.
- Modo "Desativada" mantém tudo aberto.

## Arquivos afetados
- `src/pages/crm-builder/BoardPage.tsx` — toasts nos gates existentes
- `src/pages/crm-builder/components/pipeline/PipelineColumn.tsx` — esconder botão rodapé
- `src/pages/crm-builder/hooks/useCRMBoardPermissions.ts` — extrair `computeEffectivePermission` puro
- `src/pages/crm-builder/hooks/useCRMDeals.ts` — checagem defensiva antes de cada mutação

## Fora de escopo
- RLS no Supabase (permissiva por design do projeto; mudar isso é sensível e não foi pedido).
- Alterações no UI de gestão de regras (`PermissionsManager`).