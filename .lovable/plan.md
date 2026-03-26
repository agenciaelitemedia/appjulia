# Novo Módulo: Gerador de Prompt (revisado)

## Alterações em relação ao plano anterior

1. **Prefixo `generation_**` em todas as tabelas: `generation_legal_cases` e nova `generation_prompt_config`
2. **Nova aba "Configuração"** para editar o prompt do sistema usado na geração de roteiros

## Arquitetura

```text
Sidebar → /admin/prompts → PromptGeneratorPage (5 abas)
  ├─ Gerar Roteiros (formulário + IA + resultado em 3 blocos)
  ├─ Casos Jurídicos (listagem + filtros + CRUD)
  ├─ Configuração (editar prompt do sistema)
  ├─ Prompts (placeholder "Em breve")
  └─ Templates (placeholder "Em breve")
```

## Tabelas (migração SQL)

### `generation_legal_cases`


| Coluna               | Tipo                              |
| -------------------- | --------------------------------- |
| id                   | uuid PK default gen_random_uuid() |
| case_name            | text not null                     |
| category             | text not null                     |
| case_info            | text                              |
| qualification_script | text                              |
| fees_info            | text                              |
| created_by           | text                              |
| is_active            | boolean default true              |
| created_at           | timestamptz default now()         |
| updated_at           | timestamptz default now()         |


RLS: allow all (padrão do projeto).

### `generation_prompt_config`


| Coluna      | Tipo                                          |
| ----------- | --------------------------------------------- |
| id          | uuid PK default gen_random_uuid()             |
| config_key  | text unique not null (ex: `script_generator`) |
| prompt_text | text not null                                 |
| description | text                                          |
| updated_by  | text                                          |
| created_at  | timestamptz default now()                     |
| updated_at  | timestamptz default now()                     |


RLS: allow all. Seed com o prompt completo fornecido pelo usuário (INSERT via insert tool).

## Edge Function `prompt-generator`

- Recebe `{ case_name, custom_questions }`
- Busca o prompt do sistema da tabela `generation_prompt_config` (key = `script_generator`) usando service role
- Se não encontrar, usa prompt hardcoded como fallback
- Chama Lovable AI (`google/gemini-3-flash-preview`) com o prompt + input do usuário
- Parseia resposta em 3 blocos: `case_info`, `qualification_script`, `fees_info`
- Retorna JSON

## Aba "Configuração" (`PromptConfigTab`)

- Carrega o registro `script_generator` da tabela `generation_prompt_config`
- Textarea grande (min-h-[500px]) com o prompt do sistema, editável
- Campo de descrição (readonly, informativo)
- Botão "Salvar Prompt" → upsert na tabela
- Botão "Restaurar Padrão" → restaura o prompt original hardcoded
- Toast de confirmação ao salvar

## Aba "Gerar Roteiros" (`GenerateScriptTab`)

- Input: Nome do Caso Jurídico (obrigatório)
- Textarea: Perguntas Personalizadas (opcional)
- Botão "Gerar Roteiro com IA" (loading state)
- Resultado em 3 textareas editáveis: Lista de Caso, Roteiro de Qualificação, Honorários
- Botão "Gravar Caso Jurídico" → abre `SaveCaseDialog`

## `SaveCaseDialog`

- Select: Categoria (PREVIDENCIÁRIO, TRABALHISTA, CONSUMIDOR, FAMÍLIA, CÍVIL, PENAL, GERAL)
- 3 campos pre-preenchidos e editáveis
- Salva em `generation_legal_cases`

## Aba "Casos Jurídicos" (`LegalCasesTab`)

- Filtro por nome (input) e categoria (select)
- botao Novo Caso Jurídico
- Tabela/cards com casos salvos
- Click → dialog de visualização/edição
- Botão excluir

## Hook `useEnsurePromptGeneratorModule`

- code: `prompt_generator`, name: "Gerador de Prompt"
- icon: FileText, route: /admin/prompts
- menu_group: ADMINISTRATIVO, category: admin

## Tipo `ModuleCode`

Adicionar `'prompt_generator'` ao union em `src/types/permissions.ts`.

## Arquivos


| Arquivo                                                    | Ação                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| Migração SQL                                               | Criar `generation_legal_cases` e `generation_prompt_config` |
| Insert SQL                                                 | Seed do prompt padrão na `generation_prompt_config`         |
| `supabase/functions/prompt-generator/index.ts`             | Nova edge function                                          |
| `src/types/permissions.ts`                                 | Adicionar `prompt_generator`                                |
| `src/hooks/useEnsurePromptGeneratorModule.ts`              | Novo hook                                                   |
| `src/pages/admin/prompts/PromptGeneratorPage.tsx`          | Página principal com 5 abas                                 |
| `src/pages/admin/prompts/components/GenerateScriptTab.tsx` | Aba gerar roteiros                                          |
| `src/pages/admin/prompts/components/SaveCaseDialog.tsx`    | Dialog gravar caso                                          |
| `src/pages/admin/prompts/components/LegalCasesTab.tsx`     | Aba casos jurídicos                                         |
| `src/pages/admin/prompts/components/PromptConfigTab.tsx`   | Aba configuração do prompt                                  |
| `src/pages/admin/prompts/hooks/useLegalCases.ts`           | Hook CRUD casos                                             |
| `src/App.tsx`                                              | Nova rota protegida                                         |
| `src/components/layout/Sidebar.tsx`                        | Adicionar hook ensure                                       |
