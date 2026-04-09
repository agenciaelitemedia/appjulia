

# Edição e Versionamento de Casos Jurídicos (idêntico ao Templates)

## Resumo

Adicionar botões de edição (com confirmação), exclusão (com dupla checagem) e histórico de versões na aba Casos Jurídicos, replicando o padrão já existente na aba Templates.

## 1. Migração: tabela `generation_legal_case_versions`

```sql
CREATE TABLE public.generation_legal_case_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  version_number int NOT NULL,
  case_name text NOT NULL,
  category text NOT NULL,
  case_info text,
  qualification_script text,
  fees_info text,
  changed_by text,
  change_summary text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.generation_legal_case_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on generation_legal_case_versions"
  ON public.generation_legal_case_versions FOR ALL USING (true) WITH CHECK (true);
```

## 2. Novo hook: `useLegalCaseVersions.ts`

Idêntico ao `useTemplateVersions.ts`:
- `fetchVersions(caseId)` — busca versões ordenadas desc
- `saveVersion(caseId, currentData, changedBy, changeSummary)` — salva snapshot antes de edição

## 3. Atualizar `useLegalCases.ts`

- Importar `useLegalCaseVersions` e chamar `saveVersion` dentro de `updateCase` (antes do update), gerando `change_summary` automático comparando campos alterados (Nome, Categoria, Informações, Roteiro, Honorários)
- Adicionar `updated_by` ao update

## 4. Novo componente: `LegalCaseHistoryDialog.tsx`

Réplica do `TemplateHistoryDialog.tsx` adaptada para `LegalCase`:
- Lista versões com expand/collapse
- Mostra snapshot de cada campo (case_info, qualification_script, fees_info)
- Botão "Comparar com atual" usando `DiffViewer` para cada campo
- Botão "Restaurar esta versão" com AlertDialog de confirmação

## 5. Refatorar `LegalCasesTab.tsx`

Adicionar ao card de cada caso os mesmos botões do TemplatesTab:
- **Eye** (visualizar) — já existe
- **Pencil** (editar) — abre confirmação, depois dialog de edição com campos editáveis
- **History** (histórico) — abre `LegalCaseHistoryDialog`
- **Trash2** (excluir) — dupla checagem com nome + checkbox (igual templates)

O dialog de visualização (read-only) continua, e um novo dialog de edição (com campos editáveis) é adicionado separadamente.

## Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar tabela `generation_legal_case_versions` |
| `src/pages/admin/prompts/hooks/useLegalCaseVersions.ts` | Novo hook |
| `src/pages/admin/prompts/hooks/useLegalCases.ts` | Integrar versionamento no `updateCase` |
| `src/pages/admin/prompts/components/LegalCaseHistoryDialog.tsx` | Novo componente |
| `src/pages/admin/prompts/components/LegalCasesTab.tsx` | Adicionar edição, histórico e exclusão com dupla checagem |

