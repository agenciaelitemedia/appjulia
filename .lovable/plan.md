

# Sistema de Versionamento para Templates de Prompt (revisado)

## Alteração em relação ao plano anterior

- **Formatação visual**: textos "Criado em..." e "Atualizado em..." nos cards serão exibidos em tamanho menor (`text-[11px]` ou equivalente) e cor mais suave para não competir visualmente com o conteúdo principal.

## Tabela nova (migração SQL)

### `generation_template_versions`

| Coluna | Tipo |
|---|---|
| id | uuid PK default gen_random_uuid() |
| template_id | uuid FK → generation_templates(id) ON DELETE CASCADE |
| version_number | integer not null |
| name | text not null |
| description | text |
| prompt_text | text not null |
| changed_by | text |
| change_summary | text |
| created_at | timestamptz default now() |

RLS: allow all (padrão do projeto).

## Como funciona

1. Ao editar um template, **antes** do UPDATE, o hook grava um snapshot dos dados atuais em `generation_template_versions` com version_number incrementado
2. `change_summary` é calculado no frontend comparando campos antigos vs novos (ex: "Nome e Prompt alterados")
3. Histórico acessível via botão History no card

## Interface

### Cards — formatação de metadados
- "Criado em..." e "Atualizado em..." com `text-[11px] text-muted-foreground/70` para ficarem visivelmente menores e mais discretos que o restante

### Botão Histórico (ícone History) nos cards
- Junto aos botões Visualizar/Editar/Excluir

### Dialog de Histórico
- Timeline de versões (mais recente → mais antiga): Versão #N + data + autor + resumo
- Ao clicar: expande conteúdo daquela versão
- Botão "Comparar com atual": diff visual lado a lado
- Botão "Restaurar esta versão" com confirmação

### Diff visual (DiffViewer)
- Comparação linha-a-linha simples (split por `\n`)
- Linhas removidas em vermelho, adicionadas em verde
- Sem dependência externa

## Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar `generation_template_versions` |
| `src/pages/admin/prompts/hooks/useTemplateVersions.ts` | Hook para buscar versões e restaurar |
| `src/pages/admin/prompts/hooks/useTemplates.ts` | Gravar versão antes de atualizar |
| `src/pages/admin/prompts/components/TemplateHistoryDialog.tsx` | Dialog com timeline + diff |
| `src/pages/admin/prompts/components/DiffViewer.tsx` | Componente de comparação visual |
| `src/pages/admin/prompts/components/TemplatesTab.tsx` | Botão Histórico + reduzir fonte dos metadados |

