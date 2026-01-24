
# Plano: Evolução por Hora para Períodos Curtos nos Gráficos de FollowUp

## Resumo
Quando o usuário selecionar um período de apenas 1 dia (como "Hoje" ou "Ontem"), os gráficos de evolução do Dashboard de FollowUp devem exibir dados agrupados por **hora** em vez de por **dia**, oferecendo uma visualização mais granular das métricas.

---

## Lógica de Detecção de Período Curto

```text
┌────────────────────────────────────────────────────────────────┐
│  Se dateFrom === dateTo (mesmo dia)                           │
│    → Usar agrupamento por HORA                                │
│    → Label: "08h", "09h", "10h", ...                          │
│    → Título: "Evolução por Hora de FollowUps"                 │
│                                                                │
│  Se dateFrom !== dateTo (múltiplos dias)                      │
│    → Usar agrupamento por DIA                                 │
│    → Label: "22/01", "23/01", ...                             │
│    → Título: "Evolução Diária de FollowUps"                   │
└────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

### 1. src/pages/agente/types.ts

**Renomear interface para suportar ambos granularidades:**

```typescript
// Métricas para gráficos (por dia OU por hora)
export interface FollowupMetrics {
  date: string;           // Data ou timestamp
  label: string;          // "22/01" ou "08h"
  totalRecords: number;
  messagesSent: number;
  stopped: number;
  uniqueLeads: number;
  responseRate: number;
}

// Alias para compatibilidade (pode manter FollowupDailyMetrics)
export type FollowupDailyMetrics = FollowupMetrics;
```

---

### 2. src/pages/agente/hooks/useFollowupData.ts

**Modificar `useFollowupDailyMetrics` para detectar período e usar query apropriada:**

```typescript
export function useFollowupDailyMetrics(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-daily-metrics', filters],
    queryFn: async (): Promise<FollowupDailyMetrics[]> => {
      if (!filters.agentCodes.length) return [];

      // Detectar se é período de 1 dia
      const isSingleDay = filters.dateFrom === filters.dateTo;

      const agentPlaceholders = filters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      const params: (string | number)[] = [...filters.agentCodes];

      let whereClause = `cod_agent IN (${agentPlaceholders})`;

      if (filters.dateFrom) {
        whereClause += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        params.push(filters.dateTo);
      }

      // Query diferente baseada no período
      const groupByClause = isSingleDay
        ? `EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo')` // Por hora
        : `(created_at AT TIME ZONE 'America/Sao_Paulo')::date`;           // Por dia

      const selectClause = isSingleDay
        ? `EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo')::int as hour`
        : `(created_at AT TIME ZONE 'America/Sao_Paulo')::date as date`;

      const orderClause = isSingleDay ? 'hour' : 'date';

      const result = await externalDb.raw<{
        date?: string;
        hour?: number;
        total_records: string;
        messages_sent: string;
        stopped: string;
        unique_leads: string;
      }[]>({
        query: `
          SELECT 
            ${selectClause},
            COUNT(*)::text as total_records,
            COALESCE(SUM(
              CASE 
                WHEN state = 'SEND' THEN step_number
                ELSE GREATEST(step_number - 1, 0)
              END
            ), 0)::text as messages_sent,
            COUNT(*) FILTER (WHERE state = 'STOP')::text as stopped,
            COUNT(DISTINCT session_id)::text as unique_leads
          FROM followup_queue
          WHERE ${whereClause}
          GROUP BY ${groupByClause}
          ORDER BY ${orderClause}
        `,
        params,
      });

      const flatResult = Array.isArray(result) ? result.flat() : [];

      return flatResult.map((row) => {
        const totalRecords = parseInt(row.total_records || '0', 10);
        const stopped = parseInt(row.stopped || '0', 10);
        const responseRate = totalRecords > 0 ? (stopped / totalRecords) * 100 : 0;
        
        // Formatar label baseado no tipo
        let label: string;
        let dateValue: string;
        
        if (isSingleDay && row.hour !== undefined) {
          label = `${row.hour.toString().padStart(2, '0')}h`;
          dateValue = `${filters.dateFrom}T${row.hour.toString().padStart(2, '0')}:00:00`;
        } else if (row.date) {
          const parsedDate = parseISO(row.date);
          label = format(parsedDate, 'dd/MM', { locale: ptBR });
          dateValue = row.date;
        } else {
          label = 'N/A';
          dateValue = '';
        }

        return {
          date: dateValue,
          label,
          totalRecords,
          messagesSent: parseInt(row.messages_sent || '0', 10),
          stopped,
          uniqueLeads: parseInt(row.unique_leads || '0', 10),
          responseRate,
        };
      });
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 1000 * 30,
  });
}
```

---

### 3. src/pages/agente/followup/components/FollowupDashboard.tsx

**Passar informação de granularidade para os gráficos:**

```typescript
interface FollowupDashboardProps {
  stats: FollowupStats;
  dailyMetrics: FollowupDailyMetrics[];
  isLoading: boolean;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
}

export function FollowupDashboard({
  stats,
  dailyMetrics,
  isLoading,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: FollowupDashboardProps) {
  // Detectar se é período de 1 dia
  const isSingleDay = dateFrom === dateTo;
  
  return (
    <div className="space-y-6">
      <FollowupFilters ... />
      <FollowupSummary stats={stats} isLoading={isLoading} />
      
      {/* Passar granularidade para os gráficos */}
      <FollowupEvolutionChart 
        data={dailyMetrics} 
        isLoading={isLoading} 
        granularity={isSingleDay ? 'hourly' : 'daily'}
      />
      
      <FollowupResponseRateChart 
        data={dailyMetrics} 
        isLoading={isLoading}
        granularity={isSingleDay ? 'hourly' : 'daily'}
      />
    </div>
  );
}
```

---

### 4. src/pages/agente/followup/components/FollowupEvolutionChart.tsx

**Atualizar título baseado na granularidade:**

```typescript
interface FollowupEvolutionChartProps {
  data: FollowupDailyMetrics[];
  isLoading?: boolean;
  granularity?: 'daily' | 'hourly';
}

export function FollowupEvolutionChart({ 
  data, 
  isLoading, 
  granularity = 'daily' 
}: FollowupEvolutionChartProps) {
  // Título dinâmico
  const title = granularity === 'hourly' 
    ? 'Evolução por Hora de FollowUps' 
    : 'Evolução Diária de FollowUps';
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Nenhum dado disponível para o período selecionado
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Gráfico AreaChart - sem mudanças no componente interno */}
      </CardContent>
    </Card>
  );
}
```

---

### 5. src/pages/agente/followup/components/FollowupResponseRateChart.tsx

**Atualizar título baseado na granularidade:**

```typescript
interface FollowupResponseRateChartProps {
  data: FollowupDailyMetrics[];
  isLoading?: boolean;
  granularity?: 'daily' | 'hourly';
}

export function FollowupResponseRateChart({ 
  data, 
  isLoading,
  granularity = 'daily'
}: FollowupResponseRateChartProps) {
  // Título dinâmico
  const title = granularity === 'hourly'
    ? 'Evolução por Hora da Taxa de Resposta'
    : 'Evolução da Taxa de Resposta';

  if (isLoading) { /* ... com título dinâmico */ }
  if (!data.length) { /* ... com título dinâmico */ }

  // Calculate average
  const averageRate = data.reduce((sum, d) => sum + d.responseRate, 0) / data.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <span className="text-sm font-normal text-muted-foreground">
            Média: {averageRate.toFixed(1)}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Gráfico LineChart - sem mudanças */}
      </CardContent>
    </Card>
  );
}
```

---

## Fluxo de Dados Atualizado

```text
FollowupPage
    │
    ├── dashboardDateFrom / dashboardDateTo
    │
    └── useFollowupDailyMetrics(dashboardFilters)
            │
            ├── if dateFrom === dateTo (1 dia)
            │       → GROUP BY EXTRACT(HOUR)
            │       → Labels: "00h", "01h", ..., "23h"
            │
            └── if dateFrom !== dateTo (múltiplos dias)
                    → GROUP BY ::date
                    → Labels: "22/01", "23/01", ...
            │
            └── FollowupDashboard
                    │
                    ├── granularity = isSingleDay ? 'hourly' : 'daily'
                    │
                    ├── FollowupEvolutionChart (granularity)
                    │       → Título: "Evolução por Hora..." ou "Evolução Diária..."
                    │
                    └── FollowupResponseRateChart (granularity)
                            → Título: "Evolução por Hora da Taxa..." ou "Evolução da Taxa..."
```

---

## Queries SQL

### Query por HORA (período de 1 dia)
```sql
SELECT 
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo')::int as hour,
  COUNT(*)::text as total_records,
  COALESCE(SUM(
    CASE WHEN state = 'SEND' THEN step_number ELSE GREATEST(step_number - 1, 0) END
  ), 0)::text as messages_sent,
  COUNT(*) FILTER (WHERE state = 'STOP')::text as stopped,
  COUNT(DISTINCT session_id)::text as unique_leads
FROM followup_queue
WHERE cod_agent IN ($1)
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3
GROUP BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo')
ORDER BY hour
```

### Query por DIA (múltiplos dias)
```sql
SELECT 
  (created_at AT TIME ZONE 'America/Sao_Paulo')::date as date,
  COUNT(*)::text as total_records,
  ...
GROUP BY (created_at AT TIME ZONE 'America/Sao_Paulo')::date
ORDER BY date
```

---

## Visualização do Resultado

### Período: Hoje (1 dia)
```text
┌─────────────────────────────────────────────────────────────────┐
│  Evolução por Hora de FollowUps                                 │
│                                                                  │
│  📈 Gráfico de Área                                             │
│                                                                  │
│  |                    ___                                        │
│  |              _____|   |___                                   │
│  |        ____|               |___                              │
│  |_____ |                          |___                         │
│  +------+------+------+------+------+------+                    │
│    08h    09h    10h    11h    12h    13h                       │
└─────────────────────────────────────────────────────────────────┘
```

### Período: Últimos 7 dias
```text
┌─────────────────────────────────────────────────────────────────┐
│  Evolução Diária de FollowUps                                   │
│                                                                  │
│  📈 Gráfico de Área                                             │
│                                                                  │
│  |                         ___                                   │
│  |              ___       |   |                                  │
│  |        ____|    |___  |     |___                             │
│  |_____ |               |           |___                        │
│  +------+------+------+------+------+------+------+             │
│   17/01  18/01  19/01  20/01  21/01  22/01  23/01               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Ordem de Implementação

1. **useFollowupData.ts** - Modificar `useFollowupDailyMetrics` para detectar período e usar query por hora ou por dia

2. **FollowupDashboard.tsx** - Calcular `isSingleDay` e passar `granularity` para os gráficos

3. **FollowupEvolutionChart.tsx** - Adicionar prop `granularity` e atualizar título dinamicamente

4. **FollowupResponseRateChart.tsx** - Adicionar prop `granularity` e atualizar título dinamicamente

---

## Seção Tecnica

### Detecção de Período
```typescript
const isSingleDay = filters.dateFrom === filters.dateTo;
```

### Formatação de Labels por Hora
```typescript
// Para hora = 8
label = `${hour.toString().padStart(2, '0')}h`; // → "08h"
```

### Granularidade nos Props
```typescript
type Granularity = 'daily' | 'hourly';
```

### Tratamento de Horas Vazias
O gráfico só exibirá as horas que possuem dados. Se não houver registros às 15h, essa hora não aparecerá no gráfico (comportamento padrão do Recharts).
