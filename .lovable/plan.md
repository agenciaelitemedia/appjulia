

# Visualizar Prompt Final + Editar Prompt

## 1. Visualizar — Mostrar Prompt Final

Alterar o dialog de visualizacao em `PromptsTab.tsx` para exibir o `generated_prompt` em uma textarea readonly grande (font-mono), substituindo os campos individuais (ai_name, practice_areas, etc.) que sao menos uteis para visualizacao rapida.

O dialog mantera o titulo `[cod_agent] - agent_name` e subtitulo `business_name`, seguido do prompt final completo. Botao "Copiar" para clipboard.

## 2. Editar — Reutilizar o Wizard em modo edicao

### Alteracoes no `AgentPromptWizard.tsx`
- Aceitar props opcionais `editingPrompt: AgentPrompt` e `editingCases: AgentPromptCase[]`
- Quando presente, pre-preencher todos os estados (selectedAgent, selectedTemplate, aiConfig, cases) com os dados existentes
- Titulo muda de "Novo Prompt" para "Editar Prompt"
- No step 0 (Agente), mostrar o agente ja selecionado (somente leitura — nao permite trocar agente na edicao)
- No save, chamar `updatePrompt` ao inves de `createPrompt`

### Alteracoes no `PromptsTab.tsx`
- Adicionar botao Editar (Pencil) nos cards (ja tem o import mas nao esta sendo usado)
- Estado `editingPrompt` + `editingCases` para controlar modo edicao
- Ao clicar Editar: buscar cases via `fetchCases`, converter para `CaseData[]`, abrir wizard com dados pre-carregados
- Hook `useAgentPrompts` ja possui `updatePrompt` — sera usado no wizard

### Conversao de `AgentPromptCase` para `CaseData`
Funcao utilitaria que mapeia os campos do banco para o formato do wizard, incluindo parse de `contract_fields` (jsonb) e `ctas` (jsonb array).

## Arquivos modificados

| Arquivo | Acao |
|---|---|
| `PromptsTab.tsx` | Dialog visualizar → prompt final + botao copiar; adicionar botao Editar nos cards; estado de edicao |
| `AgentPromptWizard.tsx` | Props opcionais para modo edicao; pre-preencher estados; titulo dinamico; chamar updatePrompt |

