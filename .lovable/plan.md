

# Novo Módulo: CRM Comercial

## Resumo

Criar um CRM comercial com pipeline Kanban idêntico ao CRM da Julia, com etapas próprias (Interessados, Agendar Reunião, Reunião Agendada, Remarcar Reunião, Proposta, Fechado, Perda). Dados armazenados em tabelas Supabase. Módulo auto-cadastrado e visível para admin.

## 1. Banco de Dados (Supabase - 2 migrações)

### Tabela `crm_comercial_stages`
```sql
CREATE TABLE crm_comercial_stages (
  id serial PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

INSERT INTO crm_comercial_stages (name, color, position) VALUES
  ('Interessados', '#3b82f6', 1),
  ('Agendar Reunião', '#f59e0b', 2),
  ('Reunião Agendada', '#8b5cf6', 3),
  ('Remarcar Reunião', '#f97316', 4),
  ('Proposta', '#06b6d4', 5),
  ('Fechado', '#10b981', 6),
  ('Perda', '#ef4444', 7);

ALTER TABLE crm_comercial_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on crm_comercial_stages" ON crm_comercial_stages FOR ALL USING (true) WITH CHECK (true);
```

### Tabela `crm_comercial_cards`
```sql
CREATE TABLE crm_comercial_cards (
  id serial PRIMARY KEY,
  stage_id integer NOT NULL REFERENCES crm_comercial_stages(id),
  contact_name text NOT NULL DEFAULT '',
  contact_phone text,
  contact_email text,
  company_name text,
  notes text,
  value numeric DEFAULT 0,
  created_by integer,
  assigned_to integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  stage_entered_at timestamptz DEFAULT now()
);

ALTER TABLE crm_comercial_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on crm_comercial_cards" ON crm_comercial_cards FOR ALL USING (true) WITH CHECK (true);
```

### Tabela `crm_comercial_history`
```sql
CREATE TABLE crm_comercial_history (
  id serial PRIMARY KEY,
  card_id integer NOT NULL REFERENCES crm_comercial_cards(id),
  from_stage_id integer REFERENCES crm_comercial_stages(id),
  to_stage_id integer NOT NULL REFERENCES crm_comercial_stages(id),
  changed_by integer,
  changed_at timestamptz DEFAULT now(),
  notes text
);

ALTER TABLE crm_comercial_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on crm_comercial_history" ON crm_comercial_history FOR ALL USING (true) WITH CHECK (true);
```

## 2. Tipo no TypeScript

### `src/types/permissions.ts`
- Adicionar `'crm_comercial'` ao union `ModuleCode`

## 3. Hook de auto-cadastro do módulo

### `src/hooks/useEnsureCrmComercialModule.ts` (novo)
Seguir o padrão de `useEnsureJuliaOrdersModule`:
- Código: `crm_comercial`
- Nome: `CRM Comercial`
- Rota: `/comercial/crm`
- Menu group: `COMERCIAL`
- Categoria: `crm`
- Icon: `Briefcase`
- display_order: 70

## 4. Menu group

### `src/hooks/useMenuModules.ts`
- Adicionar `'COMERCIAL'` ao array `menuGroupOrder` (antes de `'CONFIGURAÇÕES'`)

## 5. Páginas

### `src/pages/comercial/crm/CRMComercialPage.tsx` (novo)
Página principal com:
- Header "CRM Comercial"
- Filtros (busca texto + datas)
- Totalizadores por etapa (reutiliza padrão do CRM Julia)
- Pipeline Kanban horizontal com colunas por etapa
- Dialog para criar/editar cards
- Drag & drop para mover cards entre etapas (atualiza stage_id e cria history)

### `src/pages/comercial/crm/types.ts` (novo)
Tipos locais: `ComercialStage`, `ComercialCard`, `ComercialHistory`

### `src/pages/comercial/crm/hooks/useCrmComercialData.ts` (novo)
Hooks React Query usando `supabase` client direto (tabelas Supabase):
- `useCrmComercialStages()` — busca stages
- `useCrmComercialCards(filters)` — busca cards com join no stage
- `useMoveComercialCard()` — mutation para mover card entre stages
- `useCreateComercialCard()` — mutation para criar card
- `useUpdateComercialCard()` — mutation para editar card

### Componentes reutilizáveis (novos em `src/pages/comercial/crm/components/`)
- `ComercialPipeline.tsx` — grid horizontal de colunas (mesmo layout do CRM Julia)
- `ComercialPipelineColumn.tsx` — coluna com header colorido + cards paginados (30 por vez)
- `ComercialLeadCard.tsx` — card simplificado (nome, empresa, telefone, valor, tempo na etapa, botão detalhes)
- `ComercialCardDialog.tsx` — dialog para criar/editar deal
- `ComercialTotalizers.tsx` — totalizadores por etapa
- `ComercialHeader.tsx` — header com título e botão atualizar

## 6. Rota

### `src/App.tsx`
- Import `CRMComercialPage`
- Adicionar rota: `<Route path="/comercial/crm" element={<ProtectedRoute module="crm_comercial"><CRMComercialPage /></ProtectedRoute>} />`

## 7. Sidebar

### Onde o ensure é chamado
- No Sidebar/MainLayout, chamar `useEnsureCrmComercialModule()` para auto-cadastrar o módulo

## Arquivos alterados/criados

| Arquivo | Ação |
|---|---|
| Migração SQL | 3 tabelas + seed de stages |
| `src/types/permissions.ts` | Adicionar `crm_comercial` ao ModuleCode |
| `src/hooks/useMenuModules.ts` | Adicionar `COMERCIAL` ao menuGroupOrder |
| `src/hooks/useEnsureCrmComercialModule.ts` | Novo — auto-cadastro do módulo |
| `src/pages/comercial/crm/types.ts` | Novo — tipos |
| `src/pages/comercial/crm/hooks/useCrmComercialData.ts` | Novo — hooks de dados |
| `src/pages/comercial/crm/CRMComercialPage.tsx` | Novo — página principal |
| `src/pages/comercial/crm/components/*.tsx` | Novos — 6 componentes de UI |
| `src/App.tsx` | Nova rota + import |
| Sidebar (MainLayout ou similar) | Chamar ensure hook |

