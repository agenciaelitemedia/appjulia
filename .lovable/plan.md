## Objetivo

No painel de detalhes do CRM Builder, ao trocar o card para outro quadro: depois de escolher o quadro, carregar as etapas ativas dele e exigir que o usuário clique em uma etapa específica — o clique na etapa é o gesto que confirma a mudança (substituindo o atual diálogo "Tem certeza?" que já cai direto na primeira etapa).

## Comportamento atual

`src/pages/crm-builder/components/deals/DealDetailsSheet.tsx`:
- Bloco "Mover para outro CRM" lista os outros quadros.
- Clicar em um quadro abre `AlertDialog` de confirmação.
- Confirmar chama `onMoveToBoard(boardId)` → `useMoveDealToBoard` move sempre para a **primeira pipeline ativa** do destino.

## Comportamento desejado

1. Ao clicar em um quadro da lista, **não abre confirmação**.
2. Em vez disso, expande inline (logo abaixo daquele quadro) a lista de etapas ativas do quadro selecionado, ordenadas por `position`.
3. Cada etapa é um botão com cor + nome (mesmo padrão visual das etapas atuais).
4. Clicar em uma etapa abre o `AlertDialog` de confirmação dizendo: *"Mover o card do CRM "X" / etapa "Y" para o CRM "A" / etapa "B"?"*.
5. Confirmar move o card para o quadro **e** etapa escolhidos.
6. Cancelar volta para a seleção de etapa (mantém o quadro escolhido expandido). Botão "voltar" para reescolher outro quadro.
7. Loading state enquanto carrega etapas do quadro alvo.

## Mudanças técnicas

### `src/pages/crm-builder/hooks/useMoveDealToBoard.ts`
- Adicionar parâmetro opcional `targetPipelineId?: string` ao callback.
- Se vier informado, usar esse pipeline em vez da "primeira ativa". Manter fallback atual quando ausente (compatível com usos existentes).
- Validar que o pipeline pertence ao `targetBoardId` e está ativo; senão erro.

### `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx`
- Novo state: `selectedTargetBoardId: string | null`, `targetBoardStages: Pipeline[]`, `loadingTargetStages: boolean`, `pendingTargetStageId: string | null`.
- Ao clicar num board do `otherBoards.map(...)`:
  - Setar `selectedTargetBoardId` (em vez de `pendingTargetBoardId`).
  - Disparar fetch das pipelines ativas desse board (`crm_pipelines` where `board_id = X and is_active = true order by position`).
- Renderizar abaixo do board selecionado: lista de etapas (skeleton durante loading; mensagem se vazio).
- Clicar em etapa → `setPendingTargetStageId(stageId)` abre o `AlertDialog`.
- `confirmMoveToBoard` passa `(selectedTargetBoardId, pendingTargetStageId)` para `onMoveToBoard`.
- Texto do diálogo inclui nome do quadro **e** da etapa escolhidos.
- Adicionar botão "Trocar CRM" no cabeçalho da lista de etapas para limpar `selectedTargetBoardId`.

### `BoardPage.tsx` (e demais consumidores de `onMoveToBoard`)
- Atualizar a assinatura do callback para aceitar e repassar `targetPipelineId` opcional.
- Verificar se há outros consumidores (`rg "onMoveToBoard"`) e ajustar tipos.

## Itens fora de escopo

- Não muda lógica de cópia de histórico, arquivamento do original, links de chat, etc.
- Sem alteração de estilos globais; reaproveita os tokens/Tailwind já em uso.
