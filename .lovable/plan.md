## Ordenação persistente dos cards no quadro (CRM Builder)

Adicionar um controle de ordenação no cabeçalho de cada quadro (`BoardPage.tsx`), ao lado do botão de Filtros, com 4 critérios × 2 direções. A escolha fica salva por usuário + quadro e é reaplicada toda vez que o usuário entrar naquele quadro.

### 1. Ícone/menu de ordenação

Novo componente `src/pages/crm-builder/components/filters/BoardSortMenu.tsx`:
- Botão com ícone `ArrowUpDown` (lucide) + label do critério ativo.
- `DropdownMenu` com 4 grupos (Tempo na etapa, Criação do card, Atualização do card, Data de entrega).
- Cada grupo tem duas opções (Crescente / Decrescente) marcadas com check quando ativas.
- Padrão inicial: **Tempo na etapa — Decrescente** (mais tempo parado no topo).

Tipos (`types.ts`):
```ts
export type DealSortField = 'stage_entered_at' | 'created_at' | 'updated_at' | 'due_date';
export type SortDirection = 'asc' | 'desc';
export interface BoardSortState { field: DealSortField; direction: SortDirection; }
```

### 2. Persistência por usuário

Chave em `localStorage`: `crm-builder:sort:<userId>:<boardId>`.
- Ao montar `BoardPage`, ler a chave e aplicar; se ausente, usar o padrão `{ field: 'stage_entered_at', direction: 'desc' }`.
- Ao trocar, gravar imediatamente.

O escopo por `userId` garante que cada usuário mantém sua própria preferência mesmo compartilhando o mesmo quadro.

### 3. Aplicação da ordenação

Substituir o `sort((a,b) => a.position - b.position)` em `getFilteredDealsByPipeline` (em `BoardPage.tsx`) por um comparador baseado no `sortState` atual:
- `stage_entered_at`, `created_at`, `updated_at`, `due_date` → comparar como timestamps.
- Valores nulos em `due_date` vão sempre ao final (independente da direção).
- A ordenação manual por drag-and-drop (`position`) continua sendo persistida no banco, mas a exibição respeita o critério escolhido. Enquanto um drag estiver ativo (`activeDeal != null`) OU o critério for o padrão `stage_entered_at desc`, mantemos o comportamento visual do DnD sem "pular" o card — o `previewMove` já atualiza `position` e o comparador de tempo permanece estável.

### 4. Integração no cabeçalho

Em `BoardPage.tsx`, no bloco onde já ficam `BoardFilters` e `Settings2`, inserir `<BoardSortMenu value={sortState} onChange={setSortAndPersist} />` antes do botão de filtros.

### Arquivos alterados
- `src/pages/crm-builder/types.ts` (novos tipos)
- `src/pages/crm-builder/BoardPage.tsx` (estado + persistência + sort aplicado)
- `src/pages/crm-builder/components/filters/BoardSortMenu.tsx` (novo)

Sem migrações — a preferência é 100% client-side por usuário.