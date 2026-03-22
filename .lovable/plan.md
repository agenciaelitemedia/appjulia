

# Filtrar FollowUp Ativos pelo período e apenas ativos

## Problema
A query `useFollowupActiveLeads` busca **todos** os followups dos agentes selecionados sem filtro de data. Já os cards do CRM são filtrados por `stage_entered_at` no período. Resultado: 96 followups vs 32 cards.

## Solução

### `src/pages/crm/hooks/useFollowupActiveLeads.ts`

1. Adicionar parâmetros `dateFrom` e `dateTo` à função
2. Adicionar filtro `WHERE fq.step_number > 0` na query (só ativos)
3. Adicionar filtro de data na query usando `send_date` (conforme memory: followup usa `send_date` para filtrar)
4. Atualizar `queryKey` para incluir as datas

### `src/pages/crm/CRMPage.tsx`

Passar `filters.dateFrom` e `filters.dateTo` para `useFollowupActiveLeads`:
```typescript
useFollowupActiveLeads(filters.agentCodes, filters.dateFrom, filters.dateTo)
```

### `src/pages/crm/components/CRMDashboardSummary.tsx`

Remover o filtro `f.step_number > 0` do frontend (já filtrado no banco).

