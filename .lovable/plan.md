

## Plano: Adicionar Filtros de Data na Lista do Atendimento Humano

### Objetivo
Adicionar badges de período (Hoje, Ontem, 7 dias, Mês atual, 3 meses) acima da lista de leads, com "7 dias" selecionado por padrão. O filtro será aplicado client-side sobre o campo `updated_at` dos leads.

### Mudanças

#### 1. `useInactiveLeads.ts` — Adicionar estado e lógica de filtro por data

- Adicionar estado `selectedPeriod` com default `'last7days'`
- Criar função `getDateRange(period)` que retorna `{ from: Date, to: Date }` para cada período
- Filtrar leads por `updated_at` dentro do range, combinando com o filtro de busca existente
- Expor `selectedPeriod` e `setSelectedPeriod` no retorno

#### 2. `InactiveLeadsList.tsx` — Renderizar badges de período

- Adicionar uma linha de badges horizontais entre o campo de busca e a lista
- Badges: `Hoje`, `Ontem`, `7 dias`, `Mês atual`, `3 meses`
- Estilo: botões compactos com `text-xs`, o ativo recebe `bg-primary text-primary-foreground`, os demais `bg-muted text-muted-foreground`
- Scroll horizontal com `overflow-x-auto flex gap-1.5` para caber em telas menores
- Receber `selectedPeriod` e `onPeriodChange` como props

#### 3. Página pai (`HumanSupportPage` ou equivalente) — Passar as novas props

- Conectar `selectedPeriod` e `setSelectedPeriod` do hook à `InactiveLeadsList`

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/atendimento-humano/hooks/useInactiveLeads.ts` | Adicionar filtro por período com default 7 dias |
| `src/pages/atendimento-humano/components/InactiveLeadsList.tsx` | Renderizar badges de período no header |
| Página pai do Atendimento Humano | Passar props de período |

