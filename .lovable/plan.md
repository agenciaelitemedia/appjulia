

# Aba Prompts — Plano Revisado

## Mudanca principal

Casos do agente saem de um campo JSONB e vao para uma **tabela propria** `generation_agent_prompt_cases`, onde cada caso vinculado tem seus campos de personalizacao (CTAs, palavras semanticas, tokens ZapSign, contrato, honorarios, fechamento, negotiation_text processado).

## Tabelas (migracao SQL)

### `generation_agent_prompts`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| cod_agent | text NOT NULL | |
| agent_name | text | Desnormalizado |
| business_name | text | Desnormalizado |
| template_id | uuid | FK generation_templates(id) |
| ai_name | text | default 'Julia' |
| practice_areas | text | |
| working_hours | text | |
| office_info | text | |
| welcome_message | text | |
| is_active | boolean | default true |
| created_by / updated_by | text | |
| created_at / updated_at | timestamptz | default now() |

### `generation_agent_prompt_cases`

Tabela filha — cada linha e um caso vinculado ao prompt do agente com todas as personalizacoes.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| agent_prompt_id | uuid NOT NULL | FK generation_agent_prompts(id) ON DELETE CASCADE |
| case_id | uuid NOT NULL | FK generation_legal_cases(id) |
| case_name | text | Desnormalizado para exibicao |
| ctas | jsonb | default '[]' — array de strings |
| semantic_words | text | Palavras semanticas |
| case_info | text | Pre-preenchido do caso, editavel |
| qualification_script | text | Pre-preenchido do caso, editavel |
| zapsign_token | text | Padrao pre-definido |
| zapsign_doc_token | text | |
| contract_fields | jsonb | Checklist 13 campos (8 checked) |
| fees_text | text | Honorarios |
| closing_model_text | text | Modelo fechamento (do template) |
| negotiation_text | text | Resultado processado com placeholders substituidos |
| position | integer | default 0, ordem na lista |
| created_at | timestamptz | default now() |

### `generation_agent_prompt_versions`

Igual ao plano anterior — snapshot do prompt + seus casos.

| Coluna | Tipo |
|---|---|
| id | uuid PK |
| prompt_id | uuid FK ON DELETE CASCADE |
| version_number | integer |
| snapshot | jsonb |
| changed_by | text |
| change_summary | text |
| created_at | timestamptz default now() |

RLS: allow all (padrao do projeto).

## Wizard — 4 Etapas

### A — Selecao de Agente
- Reutiliza `useAgentSearch` (busca cod_agent, client_name, business_name)
- Campo busca + lista resultados clicaveis; card de confirmacao

### B — Selecao de Template
- Grid de cards dos templates ativos com radio para selecionar um
- Ao selecionar, guarda template_id e carrega closing_model_text para uso na etapa D

### C — Informacoes da IA
Campos com valores padrao (constantes em `promptDefaults.ts`):
- Nome da IA (Input, padrao "Julia")
- Areas de Atuacao (Textarea, 7 areas)
- Horario de Funcionamento (Textarea)
- Informacoes do Escritorio (Textarea)
- Mensagem de Boas Vindas (Textarea)

### D — Casos do Agente
- **Busca** em `generation_legal_cases` (campo busca + lista clicavel, estilo busca de agente)
- Selecao multipla; casos adicionados a lista de cards com botoes: Visualizar (Eye), Personalizar/Editar (Pencil), Excluir (Trash2)
- **Personalizar** abre tela/dialog com campos POR CASO:
  - CTAs do Caso (TagInput — digita + Enter = chip, salva como JSON array)
  - Palavras Semanticas (textarea)
  - Informacoes do Caso (textarea, pre-preenchido com case_info do caso)
  - Roteiro do Caso (textarea, pre-preenchido com qualification_script)
  - ZapSign Token (input, padrao pre-definido)
  - ZapSign Documento Token (input)
  - Informacoes para Contrato (13 checkboxes, 8 primeiros checked, salva JSON)
  - Honorario do Caso (textarea, padrao pre-definido)
  - Modelo de Fechamento (textarea, pre-carregado do template etapa B)
- **Ao salvar personalizacao**: processa substituicoes no closing_model_text:
  - `[[[TOKEN_ZAPSING]]]` → valor ZapSign Token
  - `[[[TOKEN_ZAPSING_DOC_UUID]]]` → valor ZapSign Doc Token
  - `[[[DADOS_COLETAR]]]` → contract_fields convertido em lista numerada
  - `[[[HONORARIOS_CASO]]]` → valor honorarios
  - Resultado exibido em campo readonly "Informacoes de Negociacao" (negotiation_text)
  - Salva tudo na linha do caso em `generation_agent_prompt_cases`
- Botao **Salvar** finaliza: grava `generation_agent_prompts` + todos os casos em `generation_agent_prompt_cases`

## Listagem (PromptsTab)

- Cards estilo TemplatesTab
- Titulo: `[cod_agent] - agent_name` / Subtitulo: `business_name`
- Metadados: criado/atualizado em (text-[11px])
- Botoes: Visualizar, Historico, Editar, Excluir (com confirmacao por digitacao + checkbox)
- Botao "Novo Prompt" no topo

## Componente TagInput

Input com chips: digita + Enter cria tag visual com X para remover. Valor: string[]. Usado nos CTAs.

## Constantes

`promptDefaults.ts` com valores padrao: areas, horarios, info escritorio, boas-vindas, honorarios, campos contrato (13 itens com label/value/checked), zapsign token padrao.

## Arquivos

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar 3 tabelas |
| `constants/promptDefaults.ts` | Constantes |
| `hooks/useAgentPrompts.ts` | CRUD prompts + casos |
| `hooks/useAgentPromptVersions.ts` | Versionamento |
| `components/PromptsTab.tsx` | Listagem + dialogs |
| `components/AgentPromptWizard.tsx` | Wizard 4 etapas |
| `components/wizard/StepAgentSearch.tsx` | Etapa A |
| `components/wizard/StepTemplateSelect.tsx` | Etapa B |
| `components/wizard/StepAIConfig.tsx` | Etapa C |
| `components/wizard/StepCaseSelect.tsx` | Etapa D |
| `components/wizard/CaseCustomizeDialog.tsx` | Dialog personalizacao do caso |
| `components/wizard/TagInput.tsx` | Componente tags/chips |
| `PromptGeneratorPage.tsx` | Habilitar aba Prompts |

