

# Novo Módulo: Casos Jurídicos

## Visão geral

Módulo dentro do grupo "SISTEMA" que exibe os 103 casos jurídicos cadastrados em cards (3 por linha), com contadores por categoria no topo que funcionam como filtros clicáveis, e modal de detalhes ao clicar em um caso.

## Arquivos a criar

### 1. `src/pages/legal-cases/LegalCasesPage.tsx`
Página principal com:
- **Contadores no topo**: mini cards horizontais com "Todos (103)" + cada categoria com seu total. Ao clicar, filtra. Card ativo recebe destaque visual (borda primary).
- **Grid de cards** (3 colunas via `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`): cada card mostra nome do caso, badge da categoria (com cores por categoria já existentes em `LegalCasesTab`), e descrição truncada (primeiras 2-3 linhas de `case_info`).
- **Modal** (Dialog) ao clicar: exibe nome, categoria badge, e seções completas — Informações do Caso, Roteiro de Qualificação, Honorários — em textareas readonly com scroll.
- Busca por nome no topo.

### 2. `src/hooks/useEnsureLegalCasesModule.ts`
Hook padrão `useEnsure*Module` para registrar o módulo:
- `code`: `'legal_cases'`
- `name`: `'Casos Jurídicos'`
- `icon`: `'Scale'`
- `route`: `'/casos-juridicos'`
- `menu_group`: `'SISTEMA'`
- `display_order`: 30
- `category`: `'sistema'`

### 3. Dados reutilizados
Reutiliza o hook `useLegalCases` existente (já busca da tabela `generation_legal_cases`).

## Arquivos a modificar

### 4. `src/types/permissions.ts`
Adicionar `'legal_cases'` ao type `ModuleCode`.

### 5. `src/App.tsx`
Adicionar rota: `<Route path="/casos-juridicos" element={<LegalCasesPage />} />`

### 6. `src/components/layout/Sidebar.tsx`
Importar e chamar `useEnsureLegalCasesModule()`.

## Layout dos contadores

```text
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ...
│  Todos   │ │ Digital  │ │ D.Civil  │ │ D.Família│
│   103    │ │    9     │ │   10     │ │   12     │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

Mini cards horizontais com scroll, estilo similar ao `CRMTotalizers`. O filtro ativo recebe `border-primary bg-primary/5`.

## Layout dos cards de caso

```text
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Auxílio-Acidente│ │ Aposentadoria   │ │ BPC LOAS        │
│ [Previdenciário]│ │ [Previdenciário]│ │ [Previdenciário] │
│ Breve descrição │ │ Breve descrição │ │ Breve descrição  │
│ do caso...      │ │ do caso...      │ │ do caso...       │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

