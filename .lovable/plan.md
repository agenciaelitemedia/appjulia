# Escolher etapa ao criar card no CRM (a partir do /chat)

Hoje, no botão **CRM** do header da conversa, ao clicar em "Criar card" o usuário escolhe apenas o **quadro** e o card é criado automaticamente na **primeira etapa**. O ajuste é tornar a escolha da etapa explícita, mantendo a primeira como padrão sugerido.

## O que muda na tela

Arquivo único afetado: `src/components/chat/CreateCrmCardSheet.tsx`.

1. **Passo 1 — Escolha do quadro** continua igual: lista de quadros expansíveis.
2. **Quando um quadro é expandido**, em vez de mostrar apenas "Entrará em: <primeira etapa>", mostrar a **lista completa de etapas** do quadro como opções clicáveis (radio-like). A primeira etapa vem **pré-selecionada** por padrão.
   - Cada item da etapa exibe a bolinha colorida + nome + ícone de check quando selecionada.
   - Clicar em uma etapa diferente atualiza `selectedPipeline` sem fechar a expansão.
3. Atualizar o texto auxiliar de "O card sempre será criado na primeira etapa do quadro" para algo como "Você pode escolher em qual etapa o card será criado".
4. O resto do fluxo (passo 2 — detalhes, vínculos Julia, criar) permanece idêntico, pois o `handleCreate` já usa `selectedPipeline`.

## Detalhes técnicos

- Reaproveitar o estado existente `selectedPipeline` / `setSelectedPipeline`. Nenhuma mudança no schema, hooks ou queries.
- Em `handleSelectBoard`, manter a lógica que carrega os pipelines via `loadPipelines(boardId)` e pré-seleciona o primeiro.
- Substituir o bloco `firstStage ? (...)` (linhas ~353-367) por um `pipelines.map(...)` renderizando botões de etapa. Cada botão chama `setSelectedPipeline(p.id)` e aplica destaque visual quando `selectedPipeline === p.id`.
- Manter o badge "Etapa selecionada" do header do passo 1.
- Sem alterações em `ChatCrmButton`, `ChatLinkedDealSheet`, hooks ou backend.

## Fora de escopo

- Não alterar a criação de cards a partir de outros lugares (CRM Builder, CRM da Julia).
- Não mexer em vínculo com Julia, prioridade, valor ou descrição.
