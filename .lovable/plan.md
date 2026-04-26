
## Problema identificado

No `BoardPage.tsx` (CRM Builder), arrastar um card para uma **coluna vazia**, ou para a **área vazia abaixo do último card** de outra coluna, frequentemente não funciona — o card "volta" para a posição original.

### Causa raiz
- A `PipelineColumn` usa apenas `useSortable` (para reordenar pipelines horizontalmente). **Não há `useDroppable`** registrado na área que contém os cards.
- Com `closestCorners` como collision detection, quando o cursor entra numa coluna sem cards (ou na faixa vazia ao lado dos cards), o dnd-kit não encontra um "drop target" válido naquela coluna e retorna `over = null` ou aponta para o último card da coluna vizinha.
- Resultado: `handleDragEnd` não consegue determinar `targetPipelineId` → nada acontece.

---

## Solução

### 1. Tornar a área de cards de cada coluna uma zona droppable
Em `src/pages/crm-builder/components/pipeline/PipelineColumn.tsx`:

- Adicionar `useDroppable({ id: \`pipeline-drop-${pipeline.id}\`, data: { type: 'pipeline-area', pipelineId: pipeline.id } })` no `<div>` que envolve a lista de cards (o container `flex-1 p-2`).
- Aplicar o `setNodeRef` do droppable nesse container interno (mantendo o `setNodeRef` do `useSortable` no wrapper externo da coluna — separação clara entre "arrastar coluna" e "soltar card na coluna").
- Garantir `min-h-[120px]` no container droppable para que colunas vazias tenham área generosa de soltura.
- Quando `isOver` do droppable for true, aplicar destaque visual (`ring-2 ring-primary/50 bg-primary/5`) — padrão já usado no `ComercialPipelineColumn.tsx`.

### 2. Atualizar `handleDragEnd` em `BoardPage.tsx`
Reconhecer o novo prefixo `pipeline-drop-` como alvo de coluna inteira:

```tsx
} else if (overId.startsWith('pipeline-drop-')) {
  targetPipelineId = overId.replace('pipeline-drop-', '');
  const pipelineDeals = getDealsByPipeline(targetPipelineId);
  newPosition = pipelineDeals.length; // anexa ao final
}
```

Manter os branches existentes (`pipeline-` e `deal-`) para compatibilidade com reorder de pipelines e drop sobre card específico.

### 3. Trocar a collision detection por uma estratégia híbrida
Substituir `closestCorners` por uma função custom que:
1. Tenta `pointerWithin` primeiro — se o cursor estiver dentro de uma coluna (qualquer ponto), prioriza essa coluna.
2. Se houver colisão com cards (`deal-*`), prefere o card mais próximo via `closestCenter` para permitir reordenação fina dentro da coluna.
3. Caso contrário, usa o droppable da coluna (`pipeline-drop-*`) como alvo.

Isso resolve simultaneamente:
- Drop em coluna vazia (sem cards).
- Drop na área lateral/abaixo dos cards de uma coluna preenchida.
- Reordenação sobre cards específicos continua funcionando.

### 4. Feedback visual durante o drag
Em `handleDragOver`, atualmente vazio, opcionalmente trackar o `overId` de coluna em estado para destacar visualmente. Como o próprio `useDroppable.isOver` já faz isso por coluna, basta usar a flag interna — sem mudança no `BoardPage`.

### 5. Manter o `DragOverlay`
Sem mudanças — o card flutuante continua renderizando o `<DealCard>` em `activeDeal`.

---

## Arquivos afetados

- `src/pages/crm-builder/BoardPage.tsx` — substitui `closestCorners` por collision detection custom; adiciona branch `pipeline-drop-` no `handleDragEnd`.
- `src/pages/crm-builder/components/pipeline/PipelineColumn.tsx` — registra `useDroppable` no container de cards; aplica destaque visual no `isOver`; garante `min-h` para colunas vazias.

## Resultado esperado

- Arrastar card para qualquer parte de uma coluna vazia → solta corretamente naquela etapa.
- Arrastar para área lateral/abaixo dos cards de uma coluna não-vazia → solta no final daquela etapa.
- Arrastar sobre um card específico → reordena ou move para a etapa daquele card (comportamento atual preservado).
- Coluna alvo destacada com borda/fundo durante o drag — UX clara.
