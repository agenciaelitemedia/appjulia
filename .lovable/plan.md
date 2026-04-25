## Ajuste no `CreateCrmCardSheet.tsx`

Hoje, ao clicar em um quadro, o painel expande mostrando **todas** as etapas para o usuário escolher. Como cards criados a partir do chat **sempre devem entrar na primeira etapa**, o passo de seleção manual é desnecessário.

### Mudanças em `src/components/chat/CreateCrmCardSheet.tsx`

1. **`handleExpand(boardId)`** — após carregar as pipelines, selecionar automaticamente a primeira (menor `position`):
   - Carregar pipelines via `loadPipelines(boardId)`.
   - Pegar `pipelines[0]` (já vêm ordenadas por `position`).
   - Chamar `handleSelectStage(boardId, pipelines[0].id)` automaticamente.
   - Se o quadro já tinha pipelines em cache, fazer o mesmo imediatamente.

2. **Renderização das etapas** dentro do quadro expandido:
   - Em vez de listar todas as pipelines como botões clicáveis, mostrar **apenas a primeira etapa** como um badge informativo (não clicável), com texto tipo: *"Entrará em: ● Nome da Etapa"*.
   - Remover o `map` de botões de etapa e o estado visual de "selecionado/não selecionado" por etapa.

3. **Label do passo 1** — atualizar de *"1. Escolha o quadro"* para algo como *"1. Escolha o quadro (entrará na primeira etapa)"* para deixar claro o comportamento.

4. **Estado**: manter `selectedBoard` e `selectedPipeline` no state (definidos automaticamente) — o resto do fluxo (passo 2 de detalhes, botão Criar) continua funcionando sem mudanças.

### Não muda
- Lógica de criação (`handleCreate`), vínculos chat/Julia, RLS, schema.
- Comportamento do CRM Builder (lá o usuário continua podendo escolher qualquer etapa via drag/drop).