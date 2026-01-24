

# Correção do Card "Taxa de Retorno"

## Problema Identificado

O card atualmente exibe "Taxa de Resposta" calculada como:
```
Taxa = (COUNT(*) de respostas / leads que receberam mensagem) × 100
```

A lógica correta para **Taxa de Retorno** é:
```
Taxa de Retorno = (leads únicos que retornaram / total de leads na fila) × 100
```

### Diferença Conceitual

| Métrica | Lógica Atual | Lógica Correta |
|---------|--------------|----------------|
| **Nome** | Taxa de Resposta | Taxa de Retorno |
| **Numerador** | COUNT(*) de followup_response (cada registro) | COUNT(DISTINCT session_id) de leads que têm registro em followup_response |
| **Denominador** | Leads que receberam mensagem (followup_history) | Total de leads na fila (followup_queue) |

---

## Arquivos a Modificar

### 1. src/pages/agente/hooks/useFollowupData.ts

#### Modificar `useFollowupResponseRate` → `useFollowupReturnRate`

**Query SQL correta:**

```sql
-- Total de leads únicos que retornaram
-- (JOIN entre followup_queue e followup_response, agrupado por cod_agent + session_id)
WITH leads_returned AS (
  SELECT DISTINCT ON (fq.cod_agent, fq.session_id)
    fq.session_id
  FROM followup_queue fq
  INNER JOIN followup_response fr ON fr.followup_queue_id = fq.id
  WHERE fq.cod_agent IN ($1, $2, ...)
    AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $from
    AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $to
  ORDER BY fq.cod_agent, fq.session_id, fr.created_at DESC
)
SELECT COUNT(*)::text as leads_returned FROM leads_returned
```

**Cálculo da taxa:**
```typescript
// Total de leads na fila (já existe em queueTotals.total)
// Leads que retornaram (nova query acima)
const returnRate = totalLeadsInQueue > 0 
  ? (leadsReturned / totalLeadsInQueue) * 100 
  : 0;
```

**Modificações no hook (linhas 589-656):**

```typescript
// Renomear para useFollowupReturnRate
export function useFollowupReturnRate(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-return-rate', filters],
    queryFn: async () => {
      if (!filters.agentCodes.length) return { 
        totalLeads: 0, 
        leadsReturned: 0, 
        responses: 0, 
        returnRate: 0 
      };

      const agentPlaceholders = filters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      
      // 1. Total de leads na fila (qualquer status)
      const queueParams: (string | number)[] = [...filters.agentCodes];
      let queueDateFilter = '';
      if (filters.dateFrom) {
        queueDateFilter += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${queueParams.length + 1}`;
        queueParams.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        queueDateFilter += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${queueParams.length + 1}`;
        queueParams.push(filters.dateTo);
      }

      const queueResult = await externalDb.raw<{ total: string }[]>({
        query: `
          SELECT COUNT(DISTINCT session_id)::text as total
          FROM followup_queue
          WHERE cod_agent IN (${agentPlaceholders})
            ${queueDateFilter}
        `,
        params: queueParams,
      });

      // 2. Leads únicos que retornaram (JOIN com followup_response)
      const returnParams: (string | number)[] = [...filters.agentCodes];
      let returnDateFilter = '';
      if (filters.dateFrom) {
        returnDateFilter += ` AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${returnParams.length + 1}`;
        returnParams.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        returnDateFilter += ` AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${returnParams.length + 1}`;
        returnParams.push(filters.dateTo);
      }

      const returnResult = await externalDb.raw<{ leads_returned: string; total_responses: string }[]>({
        query: `
          WITH response_data AS (
            SELECT DISTINCT ON (fq.cod_agent, fq.session_id)
              fq.session_id
            FROM followup_queue fq
            INNER JOIN followup_response fr ON fr.followup_queue_id = fq.id
            WHERE fq.cod_agent IN (${agentPlaceholders})
              ${returnDateFilter}
            ORDER BY fq.cod_agent, fq.session_id, fr.created_at DESC
          )
          SELECT COUNT(*)::text as leads_returned
          FROM response_data
        `,
        params: returnParams,
      });

      // 3. Total de respostas (para o card "Respostas")
      const responseResult = await externalDb.raw<{ responses: string }[]>({
        query: `
          SELECT COUNT(*)::text as responses
          FROM followup_response fr
          JOIN followup_queue fq ON fq.id = fr.followup_queue_id
          WHERE fq.cod_agent IN (${agentPlaceholders})
            ${returnDateFilter}
        `,
        params: returnParams,
      });

      const totalLeads = parseInt(queueResult.flat()[0]?.total || '0', 10);
      const leadsReturned = parseInt(returnResult.flat()[0]?.leads_returned || '0', 10);
      const responses = parseInt(responseResult.flat()[0]?.responses || '0', 10);
      
      // Taxa de Retorno = (leads que retornaram / total na fila) × 100
      const returnRate = totalLeads > 0 ? (leadsReturned / totalLeads) * 100 : 0;

      return { totalLeads, leadsReturned, responses, returnRate };
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 1000 * 30,
  });
}
```

#### Modificar `useFollowupPreviousPeriodStats` (linhas 711-775)

Aplicar a mesma lógica para o período anterior:

```typescript
// Na query de response rate do período anterior, usar a mesma lógica de retorno
const returnResult = await externalDb.raw<{ leads_returned: string }[]>({
  query: `
    WITH response_data AS (
      SELECT DISTINCT ON (fq.cod_agent, fq.session_id)
        fq.session_id
      FROM followup_queue fq
      INNER JOIN followup_response fr ON fr.followup_queue_id = fq.id
      WHERE fq.cod_agent IN (${agentPlaceholders})
        ${returnDateFilter}
      ORDER BY fq.cod_agent, fq.session_id, fr.created_at DESC
    )
    SELECT COUNT(*)::text as leads_returned
    FROM response_data
  `,
  params: returnParams,
});

// Taxa de Retorno do período anterior
const returnRate = totalQueue > 0 ? (leadsReturned / totalQueue) * 100 : 0;
```

---

### 2. src/pages/agente/followup/components/FollowupSummary.tsx

Renomear o card de "Taxa de Resposta" para "Taxa de Retorno":

```typescript
// Linha 110-119
{
  title: 'Taxa de Retorno',  // Antes: 'Taxa de Resposta'
  value: `${stats.responseRate.toFixed(1)}%`,
  icon: TrendingUp,
  color: 'text-purple-600',
  bgColor: 'bg-purple-500/10',
  change: stats.previous 
    ? calculatePpChange(stats.responseRate, stats.previous.responseRate) 
    : null,
},
```

---

### 3. src/pages/agente/followup/FollowupPage.tsx

Atualizar para usar o novo hook:

```typescript
// Importar
import { useFollowupReturnRate } from '../hooks/useFollowupData';

// Substituir useFollowupResponseRate por useFollowupReturnRate
const { data: returnData } = useFollowupReturnRate(dashboardFilters);

// No dashboardStats
const dashboardStats: FollowupStats = useMemo(() => ({
  total: queueTotals?.total || 0,
  waiting: queueTotals?.waiting || 0,
  totalSent: dailyMetrics.reduce((sum, d) => sum + d.messagesSent, 0),
  stopped: returnData?.responses || 0,           // Total de respostas
  responseRate: returnData?.returnRate || 0,     // Taxa de Retorno
  previous: isLoadingPrevious ? undefined : previousStats,
}), [queueTotals, dailyMetrics, returnData, previousStats, isLoadingPrevious]);
```

---

### 4. src/pages/agente/types.ts

Atualizar comentários para refletir a nova lógica:

```typescript
export interface FollowupStats {
  total: number;           // Total de leads na fila (qualquer status)
  totalSent: number;       // Total de mensagens enviadas
  waiting: number;         // Leads com state = 'SEND' (ativos)
  stopped: number;         // Total de respostas COUNT(*) - followup_response
  responseRate: number;    // Taxa de Retorno = (leads que retornaram / total na fila) × 100
  previous?: FollowupPreviousStats;
}
```

---

## Fluxo de Dados Corrigido

```text
              followup_queue                    followup_response
                    │                                  │
                    │ (leads únicos)                   │ (respostas)
                    │                                  │
         ┌──────────┴──────────┐                       │
         │                     │                       │
         ▼                     ▼                       │
   Total na Fila         Aguardando                    │
   (DISTINCT session)    (WHERE SEND)                  │
         │                                             │
         │                                             │
         └────────────┬────────────────────────────────┘
                      │
                      ▼
               JOIN por cod_agent + session_id
               DISTINCT ON (cod_agent, session_id)
               ORDER BY fr.created_at DESC
                      │
                      ▼
               Leads que Retornaram
               (COUNT DISTINCT)
                      │
                      ▼
               Taxa de Retorno
               = (Leads Retornaram / Total Fila) × 100
```

---

## Query SQL Principal

```sql
-- Leads únicos que retornaram à conversa
WITH response_data AS (
  SELECT DISTINCT ON (fq.cod_agent, fq.session_id)
    fq.session_id
  FROM followup_queue fq
  INNER JOIN followup_response fr ON fr.followup_queue_id = fq.id
  WHERE fq.cod_agent IN ($1, $2, ...)
    AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $from
    AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $to
  ORDER BY fq.cod_agent, fq.session_id, fr.created_at DESC
)
SELECT COUNT(*)::text as leads_returned
FROM response_data
```

---

## Resumo das Correções

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Nome do Card** | Taxa de Resposta | Taxa de Retorno |
| **Numerador** | COUNT(*) respostas | COUNT(DISTINCT) leads que retornaram |
| **Denominador** | Leads que receberam mensagem | Total de leads na fila |
| **Fórmula** | respostas / leads contatados | leads retornaram / total fila |

---

## Secao Tecnica

### Ordem de Implementacao

1. Criar/modificar hook `useFollowupReturnRate` em `useFollowupData.ts`
2. Atualizar `useFollowupPreviousPeriodStats` com mesma lógica
3. Atualizar `FollowupPage.tsx` para usar novo hook
4. Renomear card em `FollowupSummary.tsx` para "Taxa de Retorno"
5. Atualizar comentários em `types.ts`

### Índice Recomendado

```sql
CREATE INDEX idx_followup_response_queue_created 
ON followup_response(followup_queue_id, created_at);
```

