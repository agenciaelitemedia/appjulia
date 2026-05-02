## Objetivo

Padronizar a terminologia "Quadro" → "CRM" no bloco de migração entre quadros do detalhe do card, simplificar o texto explicativo, deixar a confirmação mais direta e atualizar as entradas de histórico do card original e da cópia.

## Mudanças

### 1. `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx`

**Bloco "Quadro" no header do sheet (linhas ~342–432):**
- Trocar o label `Quadro` por `CRM (Quadro CRM da Júlia)`.
- Substituir o texto explicativo:
  - De: `Ao escolher outro quadro, o card atual é arquivado e uma cópia é criada na primeira etapa do destino.`
  - Para: `Escolha o CRM que deseja mover o card.`
- Atualizar tooltips do botão de expandir: `Mover para outro CRM` (e mensagem "Nenhum outro CRM disponível para mover este card.").
- Toast de quadro sem etapas: trocar `quadro` por `CRM`.

**Diálogo de confirmação de mover (linhas ~992–1024):**
- Título: `Tem certeza que deseja mover o card do CRM "{currentBoard?.name}" para o CRM "{targetBoard?.name}"?`
- Descrição enxuta: `O card será movido e sumirá do CRM atual.` (remover o trecho sobre arquivar/cópia/primeira etapa; manter apenas a nota sobre vínculo de conversa quando `isLinked` for true: `O vínculo com a conversa será transferido para a cópia.`)
- Manter botões `Cancelar` e `Mover card`.

### 2. `src/pages/crm-builder/hooks/useMoveDealToBoard.ts`

Ajustar as duas notas inseridas em `crm_deal_history`:

- **No card original** (deal arquivado): trocar
  `Movido para o quadro "{targetBoardName}" (cópia: {newDealId})`
  por
  `Card movido para o CRM "{targetBoardName}"` (sem expor IDs).

- **No card cópia** (novo deal criado): trocar
  `Cópia do card {deal.id} (quadro {sourceBoardName})`
  por
  `Movido do CRM "{sourceBoardName}"`.

Quando `targetBoardName` ou `sourceBoardName` não estiverem disponíveis, usar fallback genérico (`outro CRM`).

## Arquivos afetados

- `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx`
- `src/pages/crm-builder/hooks/useMoveDealToBoard.ts`

## Risco

Baixo — apenas texto de UI e conteúdo das notas de histórico. Sem mudança de comportamento, schema ou fluxo de dados.