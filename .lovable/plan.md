

# Aba Templates -- Cadastro de Prompts Base da Julia

## O que sera construido

Uma aba funcional "Templates" dentro do modulo Gerador de Prompt para cadastrar, listar, editar e excluir prompts base da Julia. Cada template tem: nome, descricao e prompt (texto longo).

## Tabela (migracao SQL)

### `generation_templates`

| Coluna | Tipo |
|---|---|
| id | uuid PK default gen_random_uuid() |
| name | text not null |
| description | text |
| prompt_text | text not null |
| is_active | boolean default true |
| created_by | text |
| created_at | timestamptz default now() |
| updated_at | timestamptz default now() |

RLS: allow all (padrao do projeto).

## Arquivos

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar `generation_templates` |
| `src/pages/admin/prompts/components/TemplatesTab.tsx` | Nova aba com listagem + CRUD |
| `src/pages/admin/prompts/hooks/useTemplates.ts` | Hook CRUD (fetch, create, update, delete) |
| `src/pages/admin/prompts/PromptGeneratorPage.tsx` | Habilitar aba Templates, importar componente |

## Interface (TemplatesTab)

- **Topo**: botao "Novo Template"
- **Busca**: input de pesquisa por nome
- **Lista**: cards com nome, descricao truncada e data de criacao
  - Botoes: visualizar/editar, excluir
- **Dialog de criacao/edicao**:
  - Input: Nome do Template (obrigatorio)
  - Textarea: Descricao (opcional)
  - Textarea grande (min-h-[400px]): Prompt (obrigatorio, font-mono)
  - Botao Salvar / Cancelar
- Toast de confirmacao ao salvar/excluir

## Hook `useTemplates`

- `templates`: lista ordenada por created_at desc
- `isLoading`
- `createTemplate(name, description, prompt_text)`
- `updateTemplate(id, fields)`
- `deleteTemplate(id)` com toast de confirmacao

## Alteracao no PromptGeneratorPage

- Remover `disabled` da aba Templates
- Remover icone Clock
- Adicionar `TabsContent` com `<TemplatesTab />`

