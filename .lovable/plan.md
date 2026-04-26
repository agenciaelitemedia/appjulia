
## Diagnóstico

Ao mover um card para outra etapa, dois problemas acontecem:

### 1. Card volta para a etapa antiga após sair e voltar (não está salvando)

A causa é uma **corrida entre o update otimista e o realtime do Supabase**:

- `moveDeal` em `useCRMDeals.ts` faz update otimista local + dispara N updates paralelos (`Promise.all`) no banco.
- A subscription realtime (`postgres_changes` em `crm_deals`) escuta `event: '*'` e dispara `fetchDeals()` a cada mudança recebida.
- Como vários updates chegam em rajada, `fetchDeals` é executado várias vezes — algumas **antes** de todos os commits propagarem — devolvendo snapshots inconsistentes que **sobrescrevem o estado otimista** com a versão antiga.
- Visualmente: o card "volta" para a coluna de origem assim que recarrega o painel.

### 2. Sem placeholder/sombra entre os cards da coluna destino durante o arrasto

- O `handleDragOver` atual só muta `activeDeal` (que afeta apenas o `DragOverlay`), **não** muta o array `deals`.
- Como o `SortableContext` de cada coluna é alimentado por `getFilteredDealsByPipeline(pipeline.id)`, o card arrastado nunca aparece na lista da coluna destino enquanto o usuário ainda está arrastando.
- Resultado: o `verticalListSortingStrategy` não tem o que deslocar, e nenhum espaço é aberto entre os cards vizinhos.

---

## Solução

### A) `src/pages/crm-builder/hooks/useCRMDeals.ts`

1. **Adicionar guarda contra refetch durante movimentação ativa**:
   - Criar um `ref` `isMovingRef` (useRef) que vira `true` no início de `moveDeal` e volta para `false` ~600ms após a última escrita confirmada.
   - O handler de realtime (`postgres_changes`) deve **ignorar** eventos enquanto `isMovingRef.current === true`, evitando que fetches concorrentes sobrescrevam o estado otimista recém-aplicado.
   - Adicionar também um pequeno *debounce* (~250ms) ao `fetchDeals` chamado pelo realtime, para coalescer rajadas de eventos.

2. **Trocar updates paralelos por uma única chamada `upsert`**:
   - Substituir o `Promise.all` de N updates por um único `supabase.from('crm_deals').upsert(rows, { onConflict: 'id' })` contendo apenas as colunas necessárias (`id`, `position`, `pipeline_id`, e opcionalmente `stage_entered_at`).
   - Isso reduz a rajada de eventos realtime para 1 único batch e elimina estados intermediários inconsistentes vistos pelo refetch.
   - **Importante**: o upsert exige enviar todas as colunas NOT NULL — verificar o schema antes; se necessário, manter `Promise.all` mas envolvê-lo num `await` único antes de liberar `isMovingRef`.

3. **Logar erros silenciosos**: hoje, se algum update falha dentro do `Promise.all`, o `firstErr` é lançado mas o estado otimista já foi aplicado. Garantir que, em caso de erro, o `fetchDeals` final restaure a verdade do banco (já é feito), e exibir um `toast` claro.

### B) `src/pages/crm-builder/BoardPage.tsx`

1. **Adicionar `previewMove` no hook `useCRMDeals`** (ou expor um setter `setDeals` controlado) e usá-lo no `handleDragOver` para **mover o deal entre colunas dentro do estado** quando o cursor cruza para outra coluna:
   - Atualiza `pipeline_id` do deal arrastado no array `deals` (sem persistir).
   - Recalcula posições da coluna destino para incluir o card na posição apontada pelo cursor.
   - Isso faz com que o `SortableContext` da coluna destino passe a conter o `deal-<id>`, ativando o `verticalListSortingStrategy` — vizinhos abrem espaço suavemente e o "fantasma" do card aparece entre eles.

2. **Refinar o `handleDragOver`**:
   - Detectar coluna alvo (já feito) e índice alvo dentro dela (a partir do `over.id` ou da posição do cursor relativa ao retângulo dos cards).
   - Aplicar o preview apenas quando a coluna OU o índice mudarem (evitar re-renders desnecessários).

3. **`handleDragEnd` simplificado**:
   - Como o estado já reflete a posição final do preview, basta chamar `moveDeal` com o `pipeline_id` e a `position` já presentes no estado para esse deal. Isso elimina a divergência entre o "preview" e o "commit".

4. **Cancelamento limpo**:
   - Implementar `onDragCancel` que reverte o preview chamando `fetchDeals()` para garantir consistência se o usuário soltar fora de qualquer drop zone (Esc, drop inválido).

### C) `src/pages/crm-builder/components/deals/DealCard.tsx`

- Reduzir levemente a opacidade do card original durante o drag (`opacity-30` no `isDragging`) e manter o `DragOverlay` 100% opaco — assim o "espaço aberto" na coluna destino fica visualmente claro como um placeholder, e o cursor mostra o card sendo arrastado.

### D) (Opcional, ganho extra) `src/pages/crm-builder/components/pipeline/PipelineColumn.tsx`

- Reforçar o destaque visual quando `isOver` durante o drag de outra coluna: já existe `ring-2 ring-primary bg-primary/10`, manter; adicionar uma transição mais suave (`transition-colors duration-150`).

---

## Arquivos a editar

- `src/pages/crm-builder/hooks/useCRMDeals.ts` — guarda anti-refetch, debounce realtime, upsert único, expor `previewMove`/`setDeals` controlado.
- `src/pages/crm-builder/BoardPage.tsx` — usar `previewMove` no `handleDragOver`, simplificar `handleDragEnd`, adicionar `onDragCancel`.
- `src/pages/crm-builder/components/deals/DealCard.tsx` — ajuste fino de opacidade do placeholder.
- `src/pages/crm-builder/components/pipeline/PipelineColumn.tsx` — micro-ajuste de transição (opcional).

## Resultado esperado

- Movimentação entre etapas é **persistida de forma confiável** — refresh ou navegação não revertem mais a posição.
- Durante o arrasto, os cards da coluna destino **abrem espaço suavemente** mostrando exatamente onde o card será posicionado (placeholder visual entre vizinhos).
- Drop em qualquer área da coluna (vazia, no meio, no fim) funciona consistentemente.
