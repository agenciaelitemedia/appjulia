
# Ajustar Contadores e Gráficos para Usar Tabela followup_response

## Resumo

Modificar a contagem de respostas e os gráficos do Dashboard de FollowUp para usar a nova tabela `followup_response` ao invés de contar registros com `state = 'STOP'` na `followup_queue`. Cada registro na `followup_response` representa uma resposta/retorno real do lead à conversa.

---

## Mudança de Lógica

| Antes (Atual) | Depois (Novo) |
|---------------|---------------|
| `COUNT(*) FILTER (WHERE state = 'STOP')` em `followup_queue` | `COUNT(*)` em `followup_response` |
| Taxa baseada em paradas | Taxa baseada em respostas reais |

### Estrutura da Tabela followup_response

```sql
CREATE TABLE followup_response (
    id bigserial NOT NULL,
    followup_queue_id bigint,
    step_number smallint,
    created_at timestamp DEFAULT now()
)
```

- Cada registro = 1 resposta do lead
- `followup_queue_id` liga ao lead na fila
- `created_at` indica quando respondeu

---

## Arquivos a Modificar

### 1. src/pages/agente/hooks/useFollowupData.ts

#### A) Novo hook: `useFollowupResponseCount`

Contar respostas da tabela `followup_response`:

```typescript
export function useFollowupResponseCount(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-response-count', filters],
    queryFn: async () => {
      if (!filters.agentCodes.length) return 0;

      const agentPlaceholders = filters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      const params: (string | number)[] = [...filters.agentCodes];

      let whereClause = `fq.cod_agent IN (${agentPlaceholders})`;

      if (filters.dateFrom) {
        whereClause += ` AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause += ` AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        params.push(filters.dateTo);
      }

      const result = await externalDb.raw<{ total: string }[]>({
        query: `
          SELECT COUNT(*)::text as total
          FROM followup_response fr
          JOIN followup_queue fq ON fq.id = fr.followup_queue_id
          WHERE ${whereClause}
        `,
        params,
      });

      const flatResult = Array.isArray(result) ? result.flat() : [];
      return parseInt(flatResult[0]?.total || '0', 10);
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 1000 * 30,
  });
}
```

#### B) Modificar `useFollowupResponseRate` (linhas 506-549)

Alterar para buscar de `followup_response`:

```typescript
export function useFollowupResponseRate(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-response-rate', filters],
    queryFn: async () => {
      if (!filters.agentCodes.length) return { total: 0, responses: 0, rate: 0 };

      const agentPlaceholders = filters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      const params: (string | number)[] = [...filters.agentCodes];

      let whereClause = `fq.cod_agent IN (${agentPlaceholders})`;

      // Date filter for total leads (from followup_history)
      let historyDateFilter = '';
      if (filters.dateFrom) {
        historyDateFilter += ` AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        historyDateFilter += ` AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        params.push(filters.dateTo);
      }

      // Total leads that received at least 1 message
      const totalResult = await externalDb.raw<{ total: string }[]>({
        query: `
          SELECT COUNT(DISTINCT fq.session_id)::text as total
          FROM followup_history fh
          JOIN followup_queue fq ON fq.id = fh.followup_queue_id
          WHERE ${whereClause}
            ${historyDateFilter}
        `,
        params,
      });

      // Count responses from followup_response
      const responseParams: (string | number)[] = [...filters.agentCodes];
      let responseWhereClause = `fq.cod_agent IN (${agentPlaceholders})`;
      
      if (filters.dateFrom) {
        responseWhereClause += ` AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${responseParams.length + 1}`;
        responseParams.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        responseWhereClause += ` AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${responseParams.length + 1}`;
        responseParams.push(filters.dateTo);
      }

      const responseResult = await externalDb.raw<{ responses: string }[]>({
        query: `
          SELECT COUNT(DISTINCT fq.session_id)::text as responses
          FROM followup_response fr
          JOIN followup_queue fq ON fq.id = fr.followup_queue_id
          WHERE ${responseWhereClause}
        `,
        params: responseParams,
      });

      const total = parseInt(totalResult.flat()[0]?.total || '0', 10);
      const responses = parseInt(responseResult.flat()[0]?.responses || '0', 10);
      const rate = total > 0 ? (responses / total) * 100 : 0;

      return { total, responses, stopped: responses, rate };
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 1000 * 30,
  });
}
```

#### C) Modificar `useFollowupDailyMetrics` (linhas 404-504)

Adicionar JOIN com `followup_response` para obter respostas por período:

```typescript
// Nova query com CTE para incluir respostas
const result = await externalDb.raw<{
  date?: string;
  hour?: number;
  messages_sent: string;
  unique_leads: string;
  responses: string;
}[]>({
  query: `
    WITH history_metrics AS (
      SELECT 
        ${periodExpression} as period,
        COUNT(*)::text as messages_sent,
        COUNT(DISTINCT fq.session_id)::text as unique_leads
      FROM followup_history fh
      JOIN followup_queue fq ON fq.id = fh.followup_queue_id
      WHERE fq.cod_agent IN (${agentPlaceholders})
        ${historyDateFilter}
      GROUP BY ${periodExpression}
    ),
    response_metrics AS (
      SELECT 
        ${responsePeriodExpression} as period,
        COUNT(*)::text as responses
      FROM followup_response fr
      JOIN followup_queue fq ON fq.id = fr.followup_queue_id
      WHERE fq.cod_agent IN (${agentPlaceholders})
        ${responseDateFilter}
      GROUP BY ${responsePeriodExpression}
    )
    SELECT 
      COALESCE(h.period, r.period) as ${isSingleDay ? 'hour' : 'date'},
      COALESCE(h.messages_sent, '0') as messages_sent,
      COALESCE(h.unique_leads, '0') as unique_leads,
      COALESCE(r.responses, '0') as responses
    FROM history_metrics h
    FULL OUTER JOIN response_metrics r ON h.period = r.period
    ORDER BY COALESCE(h.period, r.period)
  `,
  params,
});

// Mapeamento atualizado
return flatResult.map((row) => {
  const messagesSent = parseInt(row.messages_sent || '0', 10);
  const uniqueLeads = parseInt(row.unique_leads || '0', 10);
  const responses = parseInt(row.responses || '0', 10);
  
  // Taxa de resposta por período
  const responseRate = uniqueLeads > 0 ? (responses / uniqueLeads) * 100 : 0;

  return {
    date: dateValue,
    label,
    totalRecords: messagesSent,
    messagesSent,
    stopped: responses, // Agora usa respostas reais
    uniqueLeads,
    responseRate,
  };
});
```

#### D) Modificar `useFollowupPreviousPeriodStats` (linhas 604-646)

Alterar query de response rate do período anterior:

```typescript
// Ao invés de contar state='STOP', buscar de followup_response
const result = await externalDb.raw<{ responses: string }[]>({
  query: `
    SELECT COUNT(DISTINCT fq.session_id)::text as responses
    FROM followup_response fr
    JOIN followup_queue fq ON fq.id = fr.followup_queue_id
    WHERE fq.cod_agent IN (${agentPlaceholders})
      AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $date_from
      AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $date_to
  `,
  params: responseParams,
});
```

---

### 2. src/pages/agente/followup/FollowupPage.tsx

Atualizar o cálculo de `dashboardStats` para usar dados de resposta:

```typescript
// dashboardStats agora usa 'responses' (não mais 'stopped')
const dashboardStats: FollowupStats = useMemo(() => ({
  total: dailyMetrics.reduce((sum, d) => sum + d.uniqueLeads, 0),
  totalSent: dailyMetrics.reduce((sum, d) => sum + d.messagesSent, 0),
  waiting: dailyMetrics.reduce((sum, d) => sum + d.uniqueLeads - d.stopped, 0),
  stopped: responseData?.responses || dailyMetrics.reduce((sum, d) => sum + d.stopped, 0),
  responseRate: responseData?.rate || 0,
  previous: isLoadingPrevious ? undefined : previousStats,
}), [dailyMetrics, responseData, previousStats, isLoadingPrevious]);
```

---

### 3. src/pages/agente/types.ts

Atualizar comentários e documentação:

```typescript
export interface FollowupStats {
  total: number;           // Leads únicos na fila
  totalSent: number;       // Total de mensagens enviadas
  waiting: number;         // Leads aguardando
  stopped: number;         // Respostas (de followup_response)
  responseRate: number;    // Taxa de resposta %
  previous?: FollowupPreviousStats;
}
```

---

## Fluxo de Dados Atualizado

```text
followup_response              followup_history
       │                              │
       │ (cada registro =             │ (cada registro =
       │  1 resposta)                 │  1 mensagem enviada)
       │                              │
       └──────────────┬───────────────┘
                      │
              ┌───────┴───────┐
              │               │
              ▼               ▼
        Respostas        Mensagens
        (COUNT)          (COUNT)
              │               │
              └───────┬───────┘
                      │
                      ▼
              Taxa de Resposta
              = (Respostas / Leads) * 100
```

---

## Resumo das Mudanças por Query

| Métrica | Antes | Depois |
|---------|-------|--------|
| Card "Respostas" | `followup_queue WHERE state='STOP'` | `COUNT(*) FROM followup_response` |
| Taxa de Resposta | `stopped / total` (queue) | `responses / uniqueLeads` (response) |
| Gráfico Evolução - Respostas | `stopped: 0` fixo | `responses` de `followup_response` por período |
| Gráfico Taxa | Não calculava | `responseRate` real por período |

---

## Secao Tecnica

### Query para Card de Respostas

```sql
SELECT COUNT(*)::text as total
FROM followup_response fr
JOIN followup_queue fq ON fq.id = fr.followup_queue_id
WHERE fq.cod_agent IN ($1, $2, ...)
  AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $date_from
  AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $date_to
```

### Query para Taxa de Resposta

```sql
-- Total de leads que receberam mensagem
WITH leads_contacted AS (
  SELECT COUNT(DISTINCT fq.session_id) as total
  FROM followup_history fh
  JOIN followup_queue fq ON fq.id = fh.followup_queue_id
  WHERE fq.cod_agent IN (...) AND ...
),
-- Leads que responderam
leads_responded AS (
  SELECT COUNT(DISTINCT fq.session_id) as responses
  FROM followup_response fr
  JOIN followup_queue fq ON fq.id = fr.followup_queue_id
  WHERE fq.cod_agent IN (...) AND ...
)
SELECT 
  l.total,
  r.responses,
  (r.responses::float / NULLIF(l.total, 0) * 100) as rate
FROM leads_contacted l, leads_responded r
```

### Query para Gráfico Evolucao (diário)

```sql
WITH history_metrics AS (
  SELECT 
    (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date as period,
    COUNT(*) as messages_sent,
    COUNT(DISTINCT fq.session_id) as unique_leads
  FROM followup_history fh
  JOIN followup_queue fq ON fq.id = fh.followup_queue_id
  WHERE fq.cod_agent IN (...)
    AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $from AND $to
  GROUP BY 1
),
response_metrics AS (
  SELECT 
    (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date as period,
    COUNT(*) as responses
  FROM followup_response fr
  JOIN followup_queue fq ON fq.id = fr.followup_queue_id
  WHERE fq.cod_agent IN (...)
    AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $from AND $to
  GROUP BY 1
)
SELECT 
  COALESCE(h.period, r.period) as date,
  COALESCE(h.messages_sent, 0) as messages_sent,
  COALESCE(h.unique_leads, 0) as unique_leads,
  COALESCE(r.responses, 0) as responses
FROM history_metrics h
FULL OUTER JOIN response_metrics r ON h.period = r.period
ORDER BY 1
```

### Indice Recomendado para Performance

```sql
CREATE INDEX idx_followup_response_queue_created 
ON followup_response(followup_queue_id, created_at);
```

---

## Ordem de Implementacao

1. Adicionar novo hook `useFollowupResponseCount` em `useFollowupData.ts`
2. Modificar `useFollowupResponseRate` para usar `followup_response`
3. Modificar `useFollowupDailyMetrics` para incluir respostas por período
4. Atualizar `useFollowupPreviousPeriodStats` para buscar respostas do período anterior
5. Ajustar `FollowupPage.tsx` para usar os novos dados de resposta
6. Atualizar comentários em `types.ts`
