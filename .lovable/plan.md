## Objetivo

No painel **Detalhes do Card** do Construtor de CRM (`DealDetailsSheet`):

1. **Reordenar a aba Detalhes** para a sequência:
   - Contato → **Responsável** → **Descrição** → **Prioridade + Tempo na Etapa** → Tags → Vínculos → Valor → Datas.
2. **Permitir mudar o quadro (board)** do card no mesmo bloco onde se muda a etapa. Ao escolher um quadro de destino:
   - O card atual é **arquivado/fechado** (status `archived`).
   - É criada uma **cópia** do card no quadro escolhido, na primeira etapa (ou em uma etapa selecionada).
   - O histórico do card original ganha uma nota: "Movido para o quadro X (cópia: <id>)".
   - O novo card recebe entrada `created` no histórico com nota: "Cópia do card <id> do quadro Y".

## Estratégia em 3 fases

### Fase 1 — Reordenação da UI (sem mudança de dados)

Arquivo: `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx`

Reorganizar a `TabsContent value="details"` para a ordem:

```text
1. Contato (mantém edição inline)
2. Responsável  ← sobe (hoje fica entre Contato e Prioridade, mas o Separator some)
3. Descrição    ← sobe (estava após Tags)
4. Cards lado a lado: Prioridade | Tempo na Etapa
5. Tags
6. Vínculos (DealLinksSection + DealJuliaPanel)
7. Valor
8. Previsão de Fechamento (se houver)
9. Datas (rodapé)
```

Ajustes visuais:
- Remover/realocar `<Separator />` para preservar respiração entre blocos.
- Manter todos os comportamentos atuais de edição inline.

### Fase 2 — Bloco "Quadro" no topo (acima do bloco "Etapa")

No mesmo cabeçalho onde hoje aparece o bloco **Etapa** (linhas ~253-322), adicionar um bloco gêmeo **Quadro** logo acima, com o mesmo padrão visual:

```text
QUADRO            [Atual: Comercial]                    [✏]
  ↳ ao expandir: lista de boards do client
       • Comercial    (atual ✓)
       • Suporte
       • Pós-venda

ETAPA             [Atual: Qualificação]                 [✏]
  ↳ (já existe)
```

Comportamento:
- Carrega os boards via hook existente `useCRMBoards({ clientId, codAgent, canManage })` filtrando `is_archived = false` e excluindo o board atual.
- Ao clicar num board de destino → abre **AlertDialog de confirmação**:
  > "Mover este card para o quadro \"X\"? O card atual será arquivado e uma cópia será criada na primeira etapa do quadro de destino. O vínculo com a conversa (se houver) é mantido na cópia."
- Após confirmar:
  1. Buscar pipelines do board destino, ordenado por `position`, pegar o primeiro `is_active`.
  2. `INSERT` em `crm_deals` clonando os campos do deal atual: `title`, `description`, `value`, `currency`, `contact_*`, `priority`, `expected_close_date`, `tags`, `assigned_to`, `custom_fields` (incluindo links chat/julia para preservar vínculo). Definir `pipeline_id` = primeiro pipeline do destino, `board_id` = destino, `position` = max+1, `status` = 'open', `stage_entered_at` = now.
  3. Inserir registro em `crm_deal_history` para o novo deal: `action='created'`, `notes='Cópia do card <id_origem> (quadro <nome_origem>)'`.
  4. `UPDATE crm_deals SET status='archived'` no card original.
  5. Inserir histórico no original: `action='updated'`, `notes='Movido para o quadro <nome_destino> (cópia: <novo_id>)'`.
  6. Fechar o sheet, invalidar queries de deals e exibir toast com link "Abrir cópia" que navega para `/crm-builder/{novoBoardId}` e abre o novo card.

### Fase 3 — Wiring nos consumidores

O `DealDetailsSheet` é usado em:
- `BoardKanbanPage` (página principal do quadro) — passar nova prop `onMoveToBoard`.
- `BoardChatSidePanel` (painel lateral no chat) — passar a mesma prop.

Adicionar nova prop opcional ao `DealDetailsSheet`:

```ts
boards?: CRMBoard[];                       // boards disponíveis (exceto atual)
onMoveToBoard?: (targetBoardId: string) => Promise<{ newDealId: string; newBoardId: string } | null>;
```

A lógica de cópia + arquivar fica em um helper `useMoveDealToBoard(boardId, codAgent, clientId)` em `src/pages/crm-builder/hooks/useCRMDeals.ts` (ou novo `useMoveDealToBoard.ts`), que encapsula os 5 passos da Fase 2.

## Detalhes técnicos

**Tabela `crm_deals`** já tem todas as colunas necessárias — não há mudança de schema.

**Vínculo de conversa**: o link Chat/Julia vive em `custom_fields.links`. Mantemos esse `custom_fields` na cópia. Importante: se houver um trigger único `(client_id, custom_fields->>chat.conversation_id)`, ao copiar o card o vínculo apontaria para a mesma conversa em dois cards. Decisão: **manter** no novo, **remover do original** durante o `UPDATE` que arquiva (zerando `custom_fields.links` ou só deixando marcado como `archived`). Verificar antes de implementar se `sync_deal_to_conversation` (trigger existente) sobrescreve algo indesejado — pelo código atual ele só sincroniza `assigned_to` e `priority`, então não há conflito.

**Permissões**: usar `canManage` igual ao restante do CRM Builder; usuários sem permissão veem o bloco Quadro como **read-only** (sem botão de editar).

**Erros e rollback**: se a cópia falhar, não arquivar o original. Se o arquivamento falhar após criar a cópia, mostrar toast de aviso com o id da nova cópia para ação manual.

## Resultado

- Painel de detalhes mais lógico, com Responsável e Descrição em destaque acima dos cards de Prioridade/Tempo.
- Possibilidade de migrar um card entre quadros sem perder histórico nem o vínculo com a conversa.
- Operação atômica do ponto de vista do usuário (1 clique → confirmação → toast com link para a nova cópia).
