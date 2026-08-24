# Ajuste de layout: um card por linha na lista de campanhas

## Objetivo
Na aba "Lista" de `/estrategico/campanhas`, os cards de campanha atualmente são exibidos em grid de múltiplas colunas (2/3/4 conforme breakpoint). O usuário quer **um card por linha**, sem duas colunas.

## Como vai funcionar
- O layout padrão da lista de campanhas passa a ser **lista vertical** (`space-y-4`), com cada `CampaignDetailCard` ocupando toda a largura disponível.
- O toggle de visualização Grid/Lista no toolbar é **removido**, já que só resta um modo de exibição.
- O estado `isGridView` é removido do componente.
- O skeleton de loading é ajustado para refletir o novo layout de lista (uma coluna, cards empilhados).

## Detalhes técnicos
1. **Arquivo**: `src/pages/estrategico/campanhas/components/CampanhasListTab.tsx`
   - Remover importações não utilizadas: `LayoutGrid`, `List`, `Toggle`.
   - Remover estado `isGridView`.
   - Substituir a renderização condicional grid/lista por uma `<div className="space-y-4">` fixa.
   - Remover os botões de toggle do toolbar.
   - Atualizar o skeleton de loading para usar `space-y-4` com cards de altura fixa em vez de grid.

## Fora de escopo
- Nenhuma mudança no conteúdo ou comportamento do `CampaignDetailCard`.
- Nenhuma mudança em filtros, ordenação, paginação ou regras de negócio.
- Nenhuma alteração em outros módulos ou telas.
