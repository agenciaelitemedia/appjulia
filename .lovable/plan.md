
# Plano: Dashboard com Taxa de Resposta e Gráficos de Evolução Diária

## Resumo
Reorganizar a página de FollowUp com 3 abas (Dashboard / Fila de Envios / Configurações), implementar a métrica de Taxa de Resposta baseada em registros desagrupados, e criar gráficos de evolução diária das métricas.

---

## Entendimento da Taxa de Resposta

### Definição
A **Taxa de Resposta** mede quantos leads responderam ao reengajamento, considerando **todos os registros** (não agrupados):

- Um lead que responde tem seu estado alterado para `STOP`
- A taxa é calculada sobre o universo total de tentativas de contato

### Fórmula (registros desagrupados)
```text
Taxa de Resposta (%) = (Registros com state='STOP' / Total de Registros) * 100
```

### Exemplo Prático
| id | session_id | state | Contagem |
|----|------------|-------|----------|
| 1  | lead_a     | SEND  | +1 total |
| 2  | lead_a     | SEND  | +1 total |
| 3  | lead_a     | STOP  | +1 total, +1 stop |
| 4  | lead_b     | SEND  | +1 total |
| 5  | lead_b     | QUEUE | +1 total |

**Total**: 5 registros, **STOP**: 1 registro
**Taxa de Resposta**: 1/5 = **20%**

---

## Nova Estrutura de Abas

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  FollowUp                                                     [Agente ▼] │
│  Configure as cadências de reengajamento...                              │
├─────────────────────────────────────────────────────────────────────────┤
│  [📊 Dashboard]  [📋 Fila de Envios]  [⚙️ Configurações]                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Aba Dashboard - Layout

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         FILTROS DE PERÍODO                               │
│  [Hoje] [Ontem] [7 dias]   De: [____]  Até: [____]                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────┬────────────┬───────────────┬────────────┬──────────────┐│
│  │ Leads na   │ Aguardando │ Mensagens     │ Pausados   │ Taxa de      ││
│  │ Fila       │            │ Enviadas      │ (Respostas)│ Resposta     ││
│  │   152      │    98      │    487        │    42      │   27.6%      ││
│  └────────────┴────────────┴───────────────┴────────────┴──────────────┘│
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │            EVOLUÇÃO DIÁRIA DE FOLLOWUPS                           │  │
│  │                                                                    │  │
│  │    📈 Gráfico de Área                                             │  │
│  │    - Mensagens Enviadas (verde)                                   │  │
│  │    - Respostas/Parados (azul)                                     │  │
│  │    - Leads Únicos na Fila (roxo)                                  │  │
│  │                                                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │            EVOLUÇÃO DA TAXA DE RESPOSTA                           │  │
│  │                                                                    │  │
│  │    📈 Gráfico de Linha                                            │  │
│  │    - Taxa de Resposta % por dia                                   │  │
│  │                                                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

### 1. src/pages/agente/hooks/useFollowupData.ts

**Adicionar novo hook para métricas diárias (desagrupadas):**

```typescript
// Interface para dados diários
export interface FollowupDailyMetrics {
  date: string;
  label: string;
  totalRecords: number;      // Total de registros no dia
  messagesSent: number;      // SUM das mensagens enviadas
  stopped: number;           // Registros com state='STOP'
  uniqueLeads: number;       // Leads únicos (DISTINCT session_id)
  responseRate: number;      // (stopped / totalRecords) * 100
}

// Hook para buscar métricas diárias (sem agrupamento por lead)
export function useFollowupDailyMetrics(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-daily-metrics', filters],
    queryFn: async () => {
      // Query que retorna métricas por dia SEM agrupar por lead
      const query = `
        SELECT 
          (created_at AT TIME ZONE 'America/Sao_Paulo')::date as date,
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
        WHERE cod_agent IN ($agentCodes)
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $dateFrom
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $dateTo
        GROUP BY (created_at AT TIME ZONE 'America/Sao_Paulo')::date
        ORDER BY date
      `;
      // ... processar e retornar array de FollowupDailyMetrics
    },
  });
}

// Hook para taxa de resposta global (desagrupada)
export function useFollowupResponseRate(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-response-rate', filters],
    queryFn: async () => {
      // Conta TODOS os registros (não agrupados)
      const query = `
        SELECT 
          COUNT(*)::text as total,
          COUNT(*) FILTER (WHERE state = 'STOP')::text as stopped
        FROM followup_queue
        WHERE cod_agent IN ($agentCodes)
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $dateFrom
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $dateTo
      `;
      // Retorna { total, stopped, rate }
    },
  });
}
```

---

### 2. src/pages/agente/types.ts

**Adicionar interfaces:**

```typescript
// Métricas diárias para gráficos
export interface FollowupDailyMetrics {
  date: string;
  label: string;
  totalRecords: number;
  messagesSent: number;
  stopped: number;
  uniqueLeads: number;
  responseRate: number;
}

// Stats atualizadas com taxa de resposta
export interface FollowupStats {
  total: number;           // Leads únicos na fila
  totalSent: number;       // Total de mensagens enviadas
  waiting: number;         // Leads aguardando
  stopped: number;         // Leads que responderam (STOP)
  responseRate: number;    // Taxa de resposta %
}
```

---

### 3. src/pages/agente/followup/components/FollowupDashboard.tsx (NOVO)

**Componente da aba Dashboard:**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, ... } from 'recharts';
import { FollowupFilters } from './FollowupFilters';
import { FollowupSummary } from './FollowupSummary';

interface FollowupDashboardProps {
  stats: FollowupStats;
  dailyMetrics: FollowupDailyMetrics[];
  isLoading: boolean;
  // Filtros
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
}

export function FollowupDashboard({ ... }: FollowupDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Filtros simplificados (apenas datas) */}
      <FollowupFilters ... stateFilter="all" showStateFilter={false} />
      
      {/* Cards de resumo (5 cards) */}
      <FollowupSummary stats={stats} isLoading={isLoading} />
      
      {/* Gráfico de Evolução de Métricas */}
      <FollowupEvolutionChart data={dailyMetrics} isLoading={isLoading} />
      
      {/* Gráfico de Taxa de Resposta */}
      <FollowupResponseRateChart data={dailyMetrics} isLoading={isLoading} />
    </div>
  );
}
```

---

### 4. src/pages/agente/followup/components/FollowupEvolutionChart.tsx (NOVO)

**Gráfico de evolução diária:**

```typescript
import { AreaChart, Area, XAxis, YAxis, ... } from 'recharts';

export function FollowupEvolutionChart({ data, isLoading }) {
  // Gráfico de área com 3 séries:
  // - Mensagens Enviadas (verde)
  // - Respostas (azul)
  // - Leads Únicos (primary)
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução Diária de FollowUps</CardTitle>
      </CardHeader>
      <CardContent>
        <AreaChart data={data}>
          <Area dataKey="messagesSent" name="Mensagens" stroke="#22c55e" />
          <Area dataKey="stopped" name="Respostas" stroke="#3b82f6" />
          <Area dataKey="uniqueLeads" name="Leads" stroke="hsl(var(--primary))" />
        </AreaChart>
      </CardContent>
    </Card>
  );
}
```

---

### 5. src/pages/agente/followup/components/FollowupResponseRateChart.tsx (NOVO)

**Gráfico de taxa de resposta:**

```typescript
import { LineChart, Line, XAxis, YAxis, ... } from 'recharts';

export function FollowupResponseRateChart({ data, isLoading }) {
  // Gráfico de linha mostrando taxa de resposta % por dia
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução da Taxa de Resposta</CardTitle>
      </CardHeader>
      <CardContent>
        <LineChart data={data}>
          <Line 
            dataKey="responseRate" 
            name="Taxa de Resposta (%)" 
            stroke="#8b5cf6" 
            strokeWidth={2}
          />
          {/* Tooltip formatando como porcentagem */}
        </LineChart>
      </CardContent>
    </Card>
  );
}
```

---

### 6. src/pages/agente/followup/components/FollowupSummary.tsx

**Adicionar 5º card (Taxa de Resposta):**

```typescript
const cards = [
  { title: 'Leads na Fila', value: stats.total, icon: ListTodo, ... },
  { title: 'Aguardando', value: stats.waiting, icon: Clock, ... },
  { title: 'Mensagens Enviadas', value: stats.totalSent, icon: Send, ... },
  { title: 'Respostas', value: stats.stopped, icon: MessageCircle, ... },
  { 
    title: 'Taxa de Resposta', 
    value: `${stats.responseRate.toFixed(1)}%`, 
    icon: TrendingUp,
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10',
  },
];

// Grid ajustado: 5 colunas em desktop
<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
```

---

### 7. src/pages/agente/followup/FollowupPage.tsx

**Atualizar estrutura de abas e integrar hooks:**

```typescript
import { LayoutDashboard, List, Settings } from 'lucide-react';
import { FollowupDashboard } from './components/FollowupDashboard';

export default function FollowupPage() {
  const [activeTab, setActiveTab] = useState('dashboard'); // Mudança: começa no dashboard
  
  // Hooks existentes
  const { data: queueData, ... } = useFollowupQueue(filters);
  const { data: totalSentCount = 0 } = useFollowupSentCount(filters);
  
  // Novos hooks
  const { data: dailyMetrics = [], ... } = useFollowupDailyMetrics(filters);
  const { data: responseData } = useFollowupResponseRate(filters);
  
  // Stats atualizadas
  const stats = useMemo(() => ({
    total: filteredItems.length,
    totalSent: totalSentCount,
    waiting: ...,
    stopped: responseData?.stopped || 0,
    responseRate: responseData?.rate || 0,
  }), [...]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="dashboard">
          <LayoutDashboard className="h-4 w-4 mr-2" />
          Dashboard
        </TabsTrigger>
        <TabsTrigger value="queue">
          <List className="h-4 w-4 mr-2" />
          Fila de Envios
        </TabsTrigger>
        <TabsTrigger value="config">
          <Settings className="h-4 w-4 mr-2" />
          Configurações
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard">
        <FollowupDashboard 
          stats={stats}
          dailyMetrics={dailyMetrics}
          isLoading={isLoadingQueue}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />
      </TabsContent>
      
      <TabsContent value="queue">
        {/* Conteúdo existente da fila */}
      </TabsContent>
      
      <TabsContent value="config">
        {/* Conteúdo existente de configuração */}
      </TabsContent>
    </Tabs>
  );
}
```

---

## Fluxo de Dados

```text
FollowupPage
    |
    |-- useFollowupQueue(filters) → leads únicos
    |-- useFollowupSentCount(filters) → soma de mensagens
    |-- useFollowupDailyMetrics(filters) → métricas por dia (NOVO)
    |-- useFollowupResponseRate(filters) → taxa global (NOVO)
    |
    +-- [Dashboard]
    |       |-- FollowupFilters (apenas datas)
    |       |-- FollowupSummary (5 cards incluindo taxa)
    |       |-- FollowupEvolutionChart
    |       |-- FollowupResponseRateChart
    |
    +-- [Fila de Envios]
    |       |-- FollowupFilters (completo)
    |       |-- FollowupQueue (tabela)
    |
    +-- [Configurações]
            |-- FollowupConfig
```

---

## Queries SQL Otimizadas

### Query para Métricas Diárias (desagrupadas)
```sql
SELECT 
  (created_at AT TIME ZONE 'America/Sao_Paulo')::date as date,
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
WHERE cod_agent IN ($agentCodes)
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $dateFrom
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $dateTo
GROUP BY (created_at AT TIME ZONE 'America/Sao_Paulo')::date
ORDER BY date
```

### Query para Taxa de Resposta Global
```sql
SELECT 
  COUNT(*)::text as total,
  COUNT(*) FILTER (WHERE state = 'STOP')::text as stopped
FROM followup_queue
WHERE cod_agent IN ($agentCodes)
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $dateFrom
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $dateTo
```

---

## Ordem de Implementação

1. **types.ts** - Adicionar interfaces `FollowupDailyMetrics` e atualizar `FollowupStats`

2. **useFollowupData.ts** - Criar hooks `useFollowupDailyMetrics` e `useFollowupResponseRate`

3. **FollowupSummary.tsx** - Adicionar 5º card de taxa de resposta

4. **FollowupEvolutionChart.tsx** - Criar componente de gráfico de evolução

5. **FollowupResponseRateChart.tsx** - Criar componente de gráfico de taxa

6. **FollowupDashboard.tsx** - Criar componente container da aba Dashboard

7. **FollowupPage.tsx** - Reorganizar abas (Dashboard/Fila/Config) e integrar novos hooks

---

## Seção Técnica

### Cálculo da Taxa por Dia
```typescript
// Calculado no frontend após receber os dados
dailyMetrics.map(day => ({
  ...day,
  responseRate: day.totalRecords > 0 
    ? (day.stopped / day.totalRecords) * 100 
    : 0
}))
```

### Cores dos Gráficos
| Métrica | Cor | Código |
|---------|-----|--------|
| Mensagens Enviadas | Verde | `#22c55e` |
| Respostas (STOP) | Azul | `#3b82f6` |
| Leads Únicos | Primary | `hsl(var(--primary))` |
| Taxa de Resposta | Roxo | `#8b5cf6` |

### Tooltip Formatado
```typescript
// Para o gráfico de taxa
formatter={(value) => [`${value.toFixed(1)}%`, 'Taxa de Resposta']}
```
