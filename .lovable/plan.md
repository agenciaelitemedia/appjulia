
# Drop entre etapas — soltar em qualquer espaço vazio

## Problemas identificados

Ao arrastar um card vindo de **outra etapa** para uma coluna que **já tem cards**, soltar no espaço abaixo do último card frequentemente falha. Causas:

1. **Botão "Adicionar Card" intercepta drops** — em `PipelineColumn.tsx` o botão está no meio da área droppable e captura pointer events. Quando o cursor passa por cima dele, o `pointerWithin` não consegue mapear para o `pipeline-drop-*` da coluna.
2. **Spacer está depois do botão** — o `<div className="flex-1 min-h-[40px]" />` (linha 227) só absorve drops abaixo do botão. Acima dele (entre o último card e o botão) há um vazio sem droppable explícito.
3. **Colisão prioriza cards absolutamente** — `collisionDetection` em `BoardPage.tsx` (linhas 184-189) sempre retorna primeiro o `deal-*` sob o cursor. Ao arrastar entre colunas, isso impede "soltar no fim da coluna" sempre que houver algum card pintado na região.
4. **Sem feedback visual quando o card vindo de fora paira sobre coluna com cards** — `handleDragOver` atualiza `pipeline_id` do `activeDeal`, mas o `SortableContext` interno não recebe o card como item até o `handleDragEnd`, então os cards da coluna alvo não "abrem espaço".

## Mudanças propostas

### 1. `PipelineColumn.tsx` — droppable cobrindo TUDO

- Mover o botão "Adicionar Card" para **fora** do container droppable (ex: rodapé fixo da coluna abaixo de `setDropRef`), OU envolvê-lo num wrapper com `pointer-events: none` no estado de drag e ignorar via `data-no-drop`.
  - **Solução escolhida:** mover o botão para um rodapé separado abaixo do droppable, garantindo que TODA a área entre o cabeçalho e o rodapé seja drop válido.
- Aumentar `min-h` do droppable para `min-h-[300px]` quando vazio e manter `flex-1` para crescer.
- Remover o spacer interno (não é mais necessário — o próprio container já é `flex-1`).
- Reforçar feedback visual `isOver`: `ring-2 ring-primary bg-primary/10` (mais intenso que o atual `ring-primary/50 bg-primary/5`).

### 2. `BoardPage.tsx` — colisão híbrida com prioridade contextual

Reescrever `collisionDetection` com a seguinte lógica:

- Para reordenação de pipelines (`activeId.startsWith('pipeline-')`): manter `closestCenter`.
- Para drag de deal:
  1. Calcular `pointerWithin`.
  2. Filtrar colisões por tipo: `dealCollisions` e `columnCollisions`.
  3. **Se há colisão com card da MESMA coluna do `activeDeal`** → priorizar `deal-*` (reordenação fina).
  4. **Se há colisão com card de OUTRA coluna** → comparar distância vertical: se o cursor está nos **40% inferiores** do card (perto da borda inferior) ou abaixo do último card visível, retornar a coluna (`pipeline-drop-*`); senão, retornar o card (insere antes dele).
  5. Se só há `columnCollisions`, retornar a coluna.
  6. Fallback: `rectIntersection` → `closestCorners`.

Isso resolve o caso "soltar entre colunas no espaço vazio mesmo havendo cards" sem quebrar a reordenação na mesma coluna.

### 3. `BoardPage.tsx` — `handleDragOver` move card visualmente

Quando o card vem de outra etapa e o `over` é `pipeline-drop-*` (coluna alvo):
- Já atualizamos `activeDeal.pipeline_id` localmente (feito).
- **Adicionar:** atualizar otimisticamente o estado `deals` movendo o card para o final da coluna alvo durante o drag, para que o `SortableContext` da coluna destino inclua o card e os vizinhos abram espaço.
- Reverter no `handleDragCancel` (adicionar handler).
- No `handleDragEnd`, persistir o estado final via `moveDeal`.

Para evitar thrashing, usar `useRef` com snapshot do estado original ao iniciar o drag e aplicar updates locais via `setDeals` (precisa expor `setDeals` em `useCRMDeals`, ou usar uma função utilitária `previewMove` no hook).

### 4. `useCRMDeals.ts` — expor `previewMove` (preview local sem persistir)

Adicionar função:
```ts
const previewMove = (dealId: string, toPipelineId: string, position: number) => { ... }
const cancelPreview = () => { /* restaura snapshot */ }
```

Usadas pelo `handleDragOver`/`handleDragCancel`. O `moveDeal` continua sendo a função que persiste no banco.

### 5. `DealCard.tsx` — feedback do card sob arraste

Manter o estado atual (`opacity-40 ring-2 shadow-xl`), mas reduzir a opacidade do card original para `opacity-30` durante drag para destacar mais o `DragOverlay`.

## Resultado esperado

- Soltar **em qualquer ponto** de uma coluna alvo (incluindo o espaço entre o último card e o botão "Adicionar Card", e a região lateral) move o card para o final da etapa.
- Soltar **sobre um card específico** ainda insere na posição daquele card (reordenação fina).
- Cards da coluna destino **abrem espaço em tempo real** mesmo quando o card vem de outra etapa.
- O botão "Adicionar Card" não captura mais drops indevidamente.

## Arquivos afetados

- `src/pages/crm-builder/components/pipeline/PipelineColumn.tsx`
- `src/pages/crm-builder/BoardPage.tsx`
- `src/pages/crm-builder/hooks/useCRMDeals.ts`
- `src/pages/crm-builder/components/deals/DealCard.tsx` (ajuste menor)
