

# CRM Comercial: filtro por cod_agent + drag-and-drop

## 1. Migração: adicionar `cod_agent` à tabela `crm_comercial_cards`

```sql
ALTER TABLE crm_comercial_cards ADD COLUMN cod_agent text;
CREATE INDEX idx_crm_comercial_cards_cod_agent ON crm_comercial_cards(cod_agent);
```

## 2. `src/pages/comercial/crm/types.ts`
- Adicionar `cod_agent?: string` ao tipo `ComercialCard`

## 3. `src/pages/comercial/crm/CRMComercialPage.tsx` — Substituir filtros manuais por `UnifiedFilters`

- Importar `UnifiedFilters`, `UnifiedFiltersState`, `useCRMAgents`
- Usar `useCRMAgents()` para obter lista de agentes
- Estado `filters: UnifiedFiltersState` com `agentCodes`, `dateFrom`, `dateTo`, `search`
- Passar filtros completos (incluindo `agentCodes`) para `useCrmComercialCards`
- Remover inputs manuais de busca/data, usar `<UnifiedFilters>` no lugar

## 4. `src/pages/comercial/crm/hooks/useCrmComercialData.ts`

- Adicionar `agentCodes` ao `CardFilters`
- Filtrar cards por `cod_agent` usando `.in('cod_agent', agentCodes)` quando houver agentes selecionados
- No `useCreateComercialCard`, aceitar `cod_agent` e incluir no insert

## 5. Drag-and-drop nos cards entre colunas

### `ComercialLeadCard.tsx`
- Adicionar `draggable="true"`, `onDragStart` que seta `dataTransfer` com `cardId` e `fromStageId`

### `ComercialPipelineColumn.tsx`
- Adicionar `onDragOver` (preventDefault) e `onDrop` que lê os dados e chama `onMoveCard`
- Feedback visual: estado `isDragOver` com borda highlight
- Prop `onMoveCard(cardId, fromStageId, toStageId)`

### `ComercialPipeline.tsx`
- Importar `useMoveComercialCard`, passar `onMoveCard` para cada coluna

## 6. `ComercialCardDialog.tsx`
- Já tem seletor de etapa — sem mudança necessária (já move card ao salvar se stage mudou)
- Adicionar campo `cod_agent` ao formulário de criação

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| Migração SQL | `cod_agent` na tabela `crm_comercial_cards` |
| `types.ts` | Adicionar `cod_agent` |
| `CRMComercialPage.tsx` | `UnifiedFilters` com agentes |
| `useCrmComercialData.ts` | Filtro por `agentCodes` + `cod_agent` no create |
| `ComercialLeadCard.tsx` | `draggable` + `onDragStart` |
| `ComercialPipelineColumn.tsx` | `onDragOver` + `onDrop` com feedback visual |
| `ComercialPipeline.tsx` | Integrar `useMoveComercialCard` + passar handler |
| `ComercialCardDialog.tsx` | Campo `cod_agent` no form de criação |

