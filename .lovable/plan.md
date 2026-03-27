

# Versionamento com Diff para Prompts de Agentes

## Situacao atual

O historico de versoes dos prompts de agentes ja existe (tabela `generation_agent_prompt_versions` com coluna `snapshot` JSONB), mas a UI apenas mostra o JSON bruto. Nao ha comparacao visual (diff) nem restauracao, diferente dos templates que tem `TemplateHistoryDialog` completo com `DiffViewer`.

## O que sera feito

Criar um `AgentPromptHistoryDialog` seguindo o mesmo padrao do `TemplateHistoryDialog`, com:

1. **Listagem de versoes** — cada versao mostra numero, data, autor e resumo
2. **Visualizacao do prompt salvo** — ao clicar na versao, exibe o `generated_prompt` do snapshot (em vez do JSON bruto)
3. **Comparacao visual (Diff)** — botao "Comparar com atual" usando o `DiffViewer` existente, comparando o `snapshot.prompt.generated_prompt` da versao com o `generated_prompt` atual do prompt
4. **Restauracao** — botao "Restaurar esta versao" que recarrega os dados do snapshot (prompt + cases) via `updatePrompt`

## Alteracoes

| Arquivo | Acao |
|---|---|
| `components/AgentPromptHistoryDialog.tsx` | **Novo** — Dialog com listagem, diff e restauracao, replicando o padrao do `TemplateHistoryDialog` |
| `components/PromptsTab.tsx` | Substituir o dialog inline de historico (linhas 256-303) pelo novo `AgentPromptHistoryDialog`, adicionando logica de restauracao via `updatePrompt` |
| `hooks/useAgentPrompts.ts` | Sem alteracao — `updatePrompt` ja salva versao antes de atualizar |

## Detalhes tecnicos

- O snapshot salvo em `generation_agent_prompt_versions.snapshot` tem formato `{ prompt: AgentPrompt, cases: AgentPromptCase[] }`. O diff compara `snapshot.prompt.generated_prompt` (versao antiga) vs `prompt.generated_prompt` (versao atual).
- A restauracao chama `updatePrompt` passando os dados do snapshot, o que automaticamente cria uma nova versao antes de sobrescrever.
- O `DiffViewer` (LCS-based, side-by-side) ja existente sera reutilizado sem alteracoes.

