

# Comparativo com Período Anterior nos Cards do Dashboard

## Resumo
Adicionar indicadores de evolução (positivo/negativo) em todos os 5 cards do Dashboard de FollowUp, comparando as métricas atuais com o período equivalente anterior.

---

## Lógica de Cálculo do Período Anterior

O período anterior será calculado automaticamente com base no intervalo selecionado:

| Período Atual | Período Anterior |
|---------------|------------------|
| 17/01 a 24/01 (7 dias) | 10/01 a 17/01 |
| 24/01 (hoje, 1 dia) | 23/01 (ontem) |
| 01/01 a 31/01 (30 dias) | 02/12 a 01/01 |

**Fórmula:**
- `previousDateFrom` = `dateFrom` - (duração do período)
- `previousDateTo` = `dateFrom` - 1 dia

---

## Visual dos Cards com Comparativo

```text
+--------------------------------+
|  Mensagens Enviadas            |
|  1.234                         |
|  ▲ +15.3% vs anterior   [icon] |
+--------------------------------+

+--------------------------------+
|  Taxa de Resposta              |
|  23.5%                         |
|  ▼ -2.1pp vs anterior   [icon] |
+--------------------------------+
```

- **Seta verde (▲)**: valor atual maior que anterior (positivo)
- **Seta vermelha (▼)**: valor atual menor que anterior (negativo)
- **Cinza**: sem variação ou dados insuficientes
- **pp**: pontos percentuais (para Taxa de Resposta)

---

## Arquivos a Modificar

### 1. src/lib/dateUtils.ts
Adicionar função para calcular período anterior:

```typescript
export function getPreviousPeriod(dateFrom: string, dateTo: string): { 
  previousDateFrom: string; 
  previousDateTo: string;
} {
  const from = parseISO(dateFrom);
  const to = parseISO(dateTo);
  const durationDays = differenceInDays(to, from) + 1;
  
  const previousTo = subDays(from, 1);
  const previousFrom = subDays(previousTo, durationDays - 1);
  
  return {
    previousDateFrom: format(previousFrom, 'yyyy-MM-dd'),
    previousDateTo: format(previousTo, 'yyyy-MM-dd'),
  };
}
```

---

### 2. src/pages/agente/types.ts
Estender interface `FollowupStats` para incluir dados do período anterior:

```typescript
export interface FollowupStats {
  total: number;
  totalSent: number;
  waiting: number;
  stopped: number;
  responseRate: number;
  // Dados do período anterior
  previous?: {
    total: number;
    totalSent: number;
    waiting: number;
    stopped: number;
    responseRate: number;
  };
}
```

---

### 3. src/pages/agente/hooks/useFollowupData.ts
Criar novo hook `useFollowupPreviousPeriodStats` para buscar dados do período anterior:

```typescript
export function useFollowupPreviousPeriodStats(filters: FollowupFiltersState) {
  // Calcular período anterior
  const previousPeriod = useMemo(() => {
    if (!filters.dateFrom || !filters.dateTo) return null;
    return getPreviousPeriod(filters.dateFrom, filters.dateTo);
  }, [filters.dateFrom, filters.dateTo]);

  // Buscar dados do período anterior (mesmo formato que o atual)
  const previousFilters = useMemo(() => ({
    ...filters,
    dateFrom: previousPeriod?.previousDateFrom || '',
    dateTo: previousPeriod?.previousDateTo || '',
  }), [filters, previousPeriod]);

  // Reutilizar hooks existentes com filtros do período anterior
  const sentCount = useFollowupSentCount(previousFilters);
  const responseRate = useFollowupResponseRate(previousFilters);
  const dailyMetrics = useFollowupDailyMetrics(previousFilters);

  return {
    previous: {
      totalSent: sentCount.data || 0,
      stopped: responseRate.data?.stopped || 0,
      responseRate: responseRate.data?.rate || 0,
      total: dailyMetrics.data?.reduce((sum, d) => sum + d.uniqueLeads, 0) || 0,
      waiting: dailyMetrics.data?.reduce((sum, d) => sum + d.totalRecords - d.stopped, 0) || 0,
    },
    isLoading: sentCount.isLoading || responseRate.isLoading || dailyMetrics.isLoading,
  };
}
```

---

### 4. src/pages/agente/followup/FollowupPage.tsx
Integrar o novo hook e passar dados para o Dashboard:

```typescript
// Buscar dados do período anterior
const { 
  previous: previousStats, 
  isLoading: isLoadingPrevious 
} = useFollowupPreviousPeriodStats(dashboardFilters);

// Dashboard stats incluindo período anterior
const dashboardStats: FollowupStats = useMemo(() => ({
  total: dailyMetrics.reduce((sum, d) => sum + d.uniqueLeads, 0),
  totalSent: dailyMetrics.reduce((sum, d) => sum + d.messagesSent, 0),
  waiting: dailyMetrics.reduce((sum, d) => sum + d.totalRecords - d.stopped, 0),
  stopped: responseData?.stopped || 0,
  responseRate: responseData?.rate || 0,
  previous: previousStats, // <-- Adicionar
}), [dailyMetrics, responseData, previousStats]);
```

---

### 5. src/pages/agente/followup/components/FollowupSummary.tsx
Atualizar componente para exibir comparativo visual:

```typescript
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

// Função para calcular variação percentual
function calculateChange(current: number, previous: number): {
  value: number;
  isPositive: boolean;
  isNeutral: boolean;
  label: string;
} {
  if (previous === 0) {
    return { value: 0, isPositive: true, isNeutral: current === 0, label: 'N/A' };
  }
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(change),
    isPositive: change >= 0,
    isNeutral: Math.abs(change) < 0.1,
    label: `${change >= 0 ? '+' : '-'}${Math.abs(change).toFixed(1)}%`,
  };
}

// Para Taxa de Resposta (pontos percentuais)
function calculatePpChange(current: number, previous: number): {
  value: number;
  isPositive: boolean;
  label: string;
} {
  const diff = current - previous;
  return {
    value: Math.abs(diff),
    isPositive: diff >= 0,
    label: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}pp`,
  };
}

// No array de cards, adicionar campo de comparativo:
const cards = [
  {
    title: 'Mensagens Enviadas',
    value: stats.totalSent.toLocaleString('pt-BR'),
    change: stats.previous 
      ? calculateChange(stats.totalSent, stats.previous.totalSent) 
      : null,
    // ...
  },
  {
    title: 'Taxa de Resposta',
    value: `${stats.responseRate.toFixed(1)}%`,
    change: stats.previous 
      ? calculatePpChange(stats.responseRate, stats.previous.responseRate) 
      : null,
    // Usa pontos percentuais para taxa
  },
  // ... outros cards
];

// No render, adicionar indicador:
<div className="flex items-center gap-1 text-xs mt-1">
  {card.change && !card.change.isNeutral && (
    <>
      {card.change.isPositive ? (
        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
      ) : (
        <ArrowDownRight className="h-3 w-3 text-red-500" />
      )}
      <span className={card.change.isPositive ? 'text-emerald-600' : 'text-red-600'}>
        {card.change.label}
      </span>
      <span className="text-muted-foreground">vs anterior</span>
    </>
  )}
</div>
```

---

## Fluxo de Dados

```text
Filtros Dashboard (dateFrom, dateTo)
        │
        ├─────────────────────────────────────┐
        │                                     │
        ▼                                     ▼
  Período Atual                    Período Anterior (calculado)
  17/01 - 24/01                    10/01 - 16/01
        │                                     │
        ▼                                     ▼
  useFollowupDailyMetrics          useFollowupPreviousPeriodStats
  useFollowupResponseRate          (reutiliza mesmos hooks)
  useFollowupSentCount
        │                                     │
        └──────────────┬──────────────────────┘
                       │
                       ▼
              FollowupStats {
                total, totalSent, waiting, stopped, responseRate,
                previous: { total, totalSent, waiting, stopped, responseRate }
              }
                       │
                       ▼
              FollowupSummary
              (exibe cards com comparativo visual)
```

---

## Tratamento de Casos Especiais

| Cenário | Comportamento |
|---------|---------------|
| Período anterior sem dados | Exibe "N/A" em cinza |
| Variação < 0.1% | Considera neutro (sem seta) |
| Primeiro acesso (sem histórico) | Cards sem indicador |
| Taxa de Resposta | Usa pontos percentuais (pp) |

---

## Seção Tecnica

### Cálculo do Período Anterior

```typescript
// src/lib/dateUtils.ts
import { parseISO, differenceInDays, subDays, format } from 'date-fns';

export function getPreviousPeriod(dateFrom: string, dateTo: string): { 
  previousDateFrom: string; 
  previousDateTo: string;
  durationDays: number;
} {
  const from = parseISO(dateFrom);
  const to = parseISO(dateTo);
  const durationDays = differenceInDays(to, from) + 1; // +1 pois inclui ambos os dias
  
  const previousTo = subDays(from, 1); // Um dia antes do início atual
  const previousFrom = subDays(previousTo, durationDays - 1);
  
  return {
    previousDateFrom: format(previousFrom, 'yyyy-MM-dd'),
    previousDateTo: format(previousTo, 'yyyy-MM-dd'),
    durationDays,
  };
}
```

### Hook para Buscar Período Anterior

```typescript
// src/pages/agente/hooks/useFollowupData.ts
export function useFollowupPreviousPeriodStats(filters: FollowupFiltersState) {
  const previousPeriod = useMemo(() => {
    if (!filters.dateFrom || !filters.dateTo) return null;
    return getPreviousPeriod(filters.dateFrom, filters.dateTo);
  }, [filters.dateFrom, filters.dateTo]);

  const previousFilters: FollowupFiltersState = useMemo(() => ({
    ...filters,
    dateFrom: previousPeriod?.previousDateFrom || '',
    dateTo: previousPeriod?.previousDateTo || '',
  }), [filters, previousPeriod]);

  // Habilitar apenas se temos período válido
  const enabled = !!previousPeriod && filters.agentCodes.length > 0;

  const { data: sentCount = 0, isLoading: isLoadingSent } = useQuery({
    queryKey: ['followup-sent-count-previous', previousFilters],
    queryFn: async () => {
      if (!previousFilters.agentCodes.length || !previousFilters.dateFrom) return 0;
      // ... mesma lógica de useFollowupSentCount
    },
    enabled,
    staleTime: 1000 * 60, // Cache por 1 minuto
  });

  const { data: responseData, isLoading: isLoadingResponse } = useQuery({
    queryKey: ['followup-response-rate-previous', previousFilters],
    queryFn: async () => {
      // ... mesma lógica de useFollowupResponseRate
    },
    enabled,
    staleTime: 1000 * 60,
  });

  const { data: dailyMetrics = [], isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['followup-daily-metrics-previous', previousFilters],
    queryFn: async () => {
      // ... mesma lógica de useFollowupDailyMetrics
    },
    enabled,
    staleTime: 1000 * 60,
  });

  return useMemo(() => ({
    previous: {
      totalSent: sentCount,
      stopped: responseData?.stopped || 0,
      responseRate: responseData?.rate || 0,
      total: dailyMetrics.reduce((sum, d) => sum + d.uniqueLeads, 0),
      waiting: dailyMetrics.reduce((sum, d) => sum + d.totalRecords - d.stopped, 0),
    },
    isLoading: isLoadingSent || isLoadingResponse || isLoadingMetrics,
  }), [sentCount, responseData, dailyMetrics, isLoadingSent, isLoadingResponse, isLoadingMetrics]);
}
```

### Componente de Card com Comparativo

```typescript
// Dentro de cada card no FollowupSummary.tsx
<CardContent className="p-4">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-muted-foreground">{card.title}</p>
      <p className="text-2xl font-bold">{card.value}</p>
      
      {/* Indicador de variação */}
      {card.change && (
        <div className="flex items-center gap-1 text-xs mt-1">
          {card.change.isNeutral ? (
            <Minus className="h-3 w-3 text-muted-foreground" />
          ) : card.change.isPositive ? (
            <ArrowUpRight className="h-3 w-3 text-emerald-500" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-red-500" />
          )}
          <span className={cn(
            "font-medium",
            card.change.isNeutral ? "text-muted-foreground" :
            card.change.isPositive ? "text-emerald-600" : "text-red-600"
          )}>
            {card.change.label}
          </span>
          <span className="text-muted-foreground">vs anterior</span>
        </div>
      )}
    </div>
    <div className={`p-2 rounded-lg ${card.bgColor}`}>
      <card.icon className={`h-5 w-5 ${card.color}`} />
    </div>
  </div>
</CardContent>
```

---

## Ordem de Implementacao

1. Adicionar `getPreviousPeriod` em `dateUtils.ts`
2. Estender interface `FollowupStats` em `types.ts`
3. Criar hook `useFollowupPreviousPeriodStats` em `useFollowupData.ts`
4. Integrar hook no `FollowupPage.tsx`
5. Atualizar `FollowupSummary.tsx` com visual de comparativo

