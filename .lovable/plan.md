# Melhorias na Ordenação por Drag-and-Drop

## Problemas identificados na implementação atual

1. **Sem feedback visual durante o arrasto** — o `SortableContext` interno (linha 474 de `BoardPage.tsx`) não declara `strategy={verticalListSortingStrategy}`, então os cards vizinhos não "abrem espaço" enquanto se arrasta.
2. **Posições inconsistentes no banco** — `moveDeal` (em `useCRMDeals.ts`) atualiza apenas o `position` do card movido. Os demais cards da coluna mantêm seus valores antigos, causando empates de `position` e ordem instável após refresh.
3. **Cálculo de índice de destino incorreto** — em `handleDragEnd`, ao soltar sobre outro card na MESMA coluna mais abaixo, `newPosition = overIndex` sem ajuste de offset → o card pode parar uma posição acima do esperado.
4. **Sem `onDragOver` real** — cards só "saltam" ao soltar, sem pré-visualização entre colunas.
5. **Sensibilidade do sensor** — `distance: 8` combinado com a falta de strategy passa sensação de travamento.

## Mudanças propostas

### 1. `src/pages/crm-builder/BoardPage.tsx`

- **Importar `verticalListSortingStrategy`** de `@dnd-kit/sortable` e aplicar no `SortableContext` interno (que envolve os cards de cada coluna). Isso ativa a animação de reordenação e o "abrir espaço" do dnd-kit.
- **Implementar `handleDragOver`** para mover o card visualmente entre colunas em tempo real (atualização otimista local apenas do `pipeline_id` enquanto arrasta), restaurando se cancelar.
- **Corrigir cálculo de `newPosition`** em `handleDragEnd`:
  - Quando soltar sobre outro card na mesma coluna e o `oldIndex < overIndex`, usar `overIndex` (o card sai antes do destino, então o destino "sobe" 1 — o índice já reflete isso após remover).
  - Quando soltar sobre outro card em coluna diferente, usar `overIndex` direto.
  - Quando soltar em área vazia da coluna, usar `pipelineDeals.length`.
- **Reduzir `activationConstraint.distance` para 5** (mais responsivo) e adicionar `delay: 0`.

### 2. `src/pages/crm-builder/hooks/useCRMDeals.ts` — `moveDeal`

Reescrever para reindexar TODOS os cards afetados (origem + destino), garantindo `position` único e sequencial:

- Calcular o array final ordenado da(s) coluna(s) afetada(s) localmente usando `arrayMove` (mesma coluna) ou split/insert (entre colunas).
- Atribuir `position = índice` para cada card no array resultante.
- Aplicar update otimista no estado local com TODAS as novas posições.
- Persistir no banco via UPSERT em lote (`supabase.from('crm_deals').upsert([...])`) contendo `id`, `pipeline_id` e `position` de cada card afetado — uma única round-trip.
- Em caso de erro, reverter chamando `fetchDeals()` (já existente).
- Manter o `stage_entered_at` apenas para o card movido entre colunas distintas.

### 3. `src/pages/crm-builder/components/pipeline/PipelineColumn.tsx`

- Garantir que a área de drop (`pipeline-drop-{id}`) continue cobrindo TODA a coluna (já está com `min-h-[140px]`), mas adicionar `flex-1` no wrapper interno para que o espaço vazio abaixo dos cards também receba drops sem precisar passar pelo botão "Adicionar Card".

### 4. `DealCard.tsx`

- Aumentar levemente o `opacity` no estado `isDragging` para 0.4 e adicionar `cursor-grabbing` no body durante drag para feedback tátil.

## Resultado esperado

- Cards "abrem espaço" suavemente enquanto arrastados (mesma coluna ou entre colunas).
- Ordem persistida fica idêntica à exibida — sem saltos após refresh.
- Soltar em qualquer ponto (entre cards, no fim da coluna, em coluna vazia) coloca o card exatamente onde o cursor indica.
- Uma única chamada ao banco por movimento (upsert em lote) mantém performance.
