# Corrigir opção "Mover para outro Quadro" no detalhe do card

## Diagnóstico

Ao inspecionar `DealDetailsSheet.tsx` identifiquei dois problemas que fazem a opção desaparecer:

1. **Aninhamento incorreto**: o bloco "Quadro" foi colocado **dentro** do bloco condicional `{showStagesBlock && (...)}` (linha 334). Se o board não carregar `stages` (ou o callback `onMoveToStage` não for fornecido), o bloco "Quadro" some junto, mesmo quando `boards` e `onMoveToBoard` foram passados corretamente.

2. **Cliente com apenas 1 quadro**: a condição `showBoardsBlock = !!onMoveToBoard && otherBoards.length > 0` esconde **completamente** o bloco quando o cliente só tem 1 board cadastrado. Sem nenhuma indicação visual, o usuário acha que a feature sumiu.

A integração no `ChatLinkedDealSheet.tsx` está correta — `boards`, `onMoveToBoard`, `stages` e `onMoveToStage` estão sendo passados via React Query. O problema é puramente de renderização.

## Mudanças propostas

### 1. `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx`

- **Mover o bloco "Quadro" para fora** do `{showStagesBlock && ...}`, tornando-o um bloco independente controlado apenas por `!!onMoveToBoard`.
- **Mudar a condição de visibilidade**: passar a renderizar o bloco "Quadro" sempre que `onMoveToBoard` estiver definido (mesmo quando há só 1 board), exibindo:
  - O quadro atual (read-only, como hoje).
  - Se `otherBoards.length === 0`, mostrar texto auxiliar discreto: *"Nenhum outro quadro disponível para mover este card."* — assim o usuário entende por que não há ação.
  - Se `otherBoards.length > 0`, manter o botão de expandir e a lista atual (já com validação de etapas vazias implementada).
- Garantir que a ordem visual continue: **Quadro → Etapa → Abas**.

### 2. (Opcional, pequeno) garantir que o bloco apareça em ambos os pontos de uso

Verificar que `BoardPage.tsx` e `DealJuliaPanel.tsx` também recebem `boards` + `onMoveToBoard`. Se algum não receber, a opção continuará oculta nessas telas. Já confirmei que `ChatLinkedDealSheet.tsx` está correto; vou validar os outros dois consumidores na implementação e completar se faltar.

## Arquivos afetados

- `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx` (mover JSX do bloco Quadro + ajustar condição)
- `src/pages/crm-builder/BoardPage.tsx` (validar wiring — ajuste só se necessário)
- `src/pages/crm-builder/components/deals/DealJuliaPanel.tsx` (validar wiring — ajuste só se necessário)

## Resultado esperado

- O bloco "Quadro" aparece sempre nos detalhes do card (independente de `stages`).
- Quando o cliente tem outros quadros: lápis para expandir e mover.
- Quando o cliente só tem 1 quadro: aviso amigável explicando que não há destinos disponíveis.
- Comportamento de cópia + arquivamento + validação de etapas ativas permanece igual.
