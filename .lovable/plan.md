# Corrigir o arrastar de etapas no painel do CRM

Hoje, ao arrastar uma etapa (coluna) pela alça de arraste no quadro do CRM Builder, o resultado é errado ou nada acontece. A causa está no código que decide o que foi feito ao soltar a coluna.

## O que está errado (confirmado no código)

1. **A etapa vai para o fim (ou não move)** — `BoardPage.tsx` trata o soltar com `overId.startsWith('pipeline-')`. As áreas de soltar cards se chamam `pipeline-drop-<id>`, e também começam com `pipeline-`. Quando a coluna arrastada para sobre o corpo de outra coluna, o alvo é `pipeline-drop-...`, o índice calculado vira `-1` e o `arrayMove` joga a etapa para a última posição.
2. **Bloqueio pela permissão errada** — `handleDragStart` e `handleDragEnd` abortam quando `canEditDeal` é falso (permissão de *cards*), mostrando "Sem permissão para mover cards" e impedindo a reordenação de etapas, que depende de outra permissão (dono do CRM).
3. **Sem retorno visual** — não há prévia/overlay ao arrastar a coluna, e quem não é dono consegue iniciar o arraste mas o salvamento é descartado em silêncio (`reorderPipelines` retorna `false` sem aviso).
4. **A alça é invisível até passar o mouse** (`opacity-0`), dificultando descobrir a funcionalidade.

## Correções

**1. Identificar corretamente o alvo do arraste de coluna** (`BoardPage.tsx`)
- No `handleDragEnd`, tratar reordenação de etapa apenas quando o item arrastado é uma coluna, e resolver o alvo aceitando os dois formatos: `pipeline-<id>` e `pipeline-drop-<id>` (normalizar para o `id` da etapa).
- Se o alvo não resolver para uma etapa válida, não fazer nada (em vez de mover para o fim).
- No `collisionDetection`, ao arrastar uma coluna, considerar somente containers de coluna (ignorar `deal-*`), para o alvo ser sempre uma etapa.

**2. Usar a permissão certa**
- `handleDragStart`/`handleDragEnd`: aplicar a checagem de `canEditDeal` (e o toast) somente para itens `deal-*`; para itens `pipeline-*`, exigir `canManage` (dono do CRM) e avisar com toast quando não houver permissão.
- `PipelineColumn`: desabilitar o `useSortable` quando o usuário não pode gerenciar (além do já existente `is_system`), e esconder a alça nesse caso — evita arraste que nunca salva.

**3. Feedback visual**
- Adicionar prévia de reordenação: manter a ordem otimista já existente em `reorderPipelines` e renderizar a coluna arrastada no `DragOverlay` (ou apenas destacar a coluna de origem/alvo), garantindo que a ordem na tela seja a mesma salva.
- Mostrar toast de erro quando `reorderPipelines` falhar.

**4. Descoberta da alça**
- Deixar a alça sempre visível em baixa opacidade (`opacity-40`) e cheia no hover/foco, apenas para etapas reordenáveis.

## Detalhes técnicos

- Arquivos: `src/pages/crm-builder/BoardPage.tsx` (handlers de DnD e `collisionDetection`), `src/pages/crm-builder/components/pipeline/PipelineColumn.tsx` (sortable/alça), `src/pages/crm-builder/hooks/useCRMPipelines.ts` (aviso ao bloquear/erro no `reorderPipelines`).
- Sem mudança de banco: `crm_pipelines.position` continua sendo reescrito como índice sequencial (0..n) pelo `reorderPipelines`, com auditoria `reordered` já existente.
- Nenhuma alteração no comportamento de arrastar cards (deals) — as regras atuais de colisão e `previewMove` permanecem.

## Validação

- Arrastar uma etapa para a esquerda/direita soltando sobre o cabeçalho e sobre o corpo de outra coluna: em ambos os casos a etapa deve parar na posição esperada e persistir após recarregar.
- Usuário sem permissão de gestão: alça ausente, sem arraste, sem toast de erro indevido.
- Usuário com permissão de gestão, mas sem permissão de editar cards: reordenação de etapas funciona.
