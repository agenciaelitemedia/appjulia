## Objetivo
No `DealCard` do CRM Builder:
1. Exibir a **descrição sempre** (mesmo quando vazia, com placeholder clicável).
2. Clicar na descrição **abre o dialog completo de edição** do card (mesmo `CreateDealDialog` usado em "Editar").
3. Tornar o **badge de responsável clicável**, abrindo um dropdown com a lista de membros da equipe para trocar o responsável direto, sem abrir o dialog completo (mesmo padrão do dropdown de prioridade).

## Mudanças

### 1. `src/pages/crm-builder/components/deals/DealCard.tsx`
- **Descrição (novo bloco)**: adicionar entre o bloco de Tags e o Footer um bloco com label "Descrição" e o conteúdo de `deal.description`.
  - Quando preenchida: texto pequeno (`text-xs text-muted-foreground`) com `line-clamp-3`.
  - Quando vazia: placeholder `"Adicionar descrição..."` em `text-muted-foreground italic`.
  - O bloco inteiro é clicável (`cursor-pointer hover:bg-muted/50 rounded p-1`), com `e.stopPropagation()` + `onPointerDown` stop, e dispara o mesmo `onEdit()` já existente no card → abre o `CreateDealDialog` em modo editar.
  - Tooltip "Clique para editar".
- **Responsável inline editável**: trocar o `<Badge>` do responsável (linhas 253-265) por um `DropdownMenu`:
  - `DropdownMenuTrigger` envolvendo um botão estilizado idêntico ao Badge atual (mesma aparência, sem regressão visual).
  - `onClick`/`onPointerDown` com `stopPropagation`.
  - `DropdownMenuContent` lista:
    - Item "Não atribuído" (passa `null`).
    - Itens com cada membro de `useTeamMembers()` (campo `name`, fallback `email`).
    - Item ativo destacado com `bg-muted font-medium`.
  - Ao clicar, dispara nova prop `onChangeAssignee?(deal, assignedTo: string | null)`.
- Adicionar nova prop `onChangeAssignee?: (deal: CRMDeal, assignedTo: string | null) => void` na interface `DealCardProps`.
- Reusar import existente `useTeamMembers` de `@/pages/equipe/hooks/useEquipeData`.

### 2. `src/pages/crm-builder/BoardPage.tsx`
- Passar nova prop `onChangeAssignee` para cada `<DealCard>`, chamando `updateDeal.mutateAsync({ id: deal.id, data: { assigned_to: value } })` (mesmo padrão de `onChangePriority` já existente).
- Nenhuma migração de banco necessária — `assigned_to` já existe e o `useCRMDeals.update` já trata o campo.

### 3. Sem mudanças em backend/SQL
Tudo client-side reaproveitando mutations existentes.

## Resultado esperado
- Bloco "Descrição" sempre presente no card; clique abre o dialog completo de edição (descrição + outros campos), conforme escolhido.
- Badge do responsável vira dropdown com a lista da equipe — troca instantânea sem abrir dialog.
- Layout/ordem do card mantém o que foi definido nas iterações anteriores.