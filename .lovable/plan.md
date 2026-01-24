
# Correção dos Contadores do Dashboard de FollowUp

## Problema Identificado

Os contadores e gráficos estão usando lógica incorreta:

| Card | Lógica Atual (ERRADA) | Lógica Correta |
|------|----------------------|----------------|
| **Leads na Fila** | Soma `uniqueLeads` de `followup_history` | COUNT de leads na `followup_queue` (qualquer status) |
| **Aguardando** | `uniqueLeads - stopped` (cálculo incorreto) | COUNT de leads com `state = 'SEND'` na `followup_queue` |
| **Respostas** | `COUNT(DISTINCT session_id)` de `followup_response` | `COUNT(*)` de `followup_response` (cada registro = 1 resposta) |
| **Taxa de Resposta** | Baseada em leads que responderam | (total respostas / leads que receberam mensagem) * 100 |

### Regras de Negócio Corretas

1. **Respostas**: Cada registro na tabela `followup_response` = 1 resposta. Um lead pode responder múltiplas vezes.
2. **Status não define resposta**: Um lead pode estar com status `SEND` (ativo) e já ter respondido antes (foi colocado manualmente de volta).
3. **Total na Fila**: Todos os leads únicos em `followup_queue` no período, independente do status.
4. **Aguardando**: Apenas leads com `state = 'SEND'` (ainda ativos no follow).

---

## Arquivos a Modificar

### 1. src/pages/agente/hooks/useFollowupData.ts

#### A) Novo hook: `useFollowupQueueTotals`

Buscar totais da fila por status:

```typescript
export function useFollowupQueueTotals(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-queue-totals', filters],
    queryFn: async () => {
      if (!filters.agentCodes.length) return { total: 0, waiting: 0 };

      const agentPlaceholders = filters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      const params: (string | number)[] = [...filters.agentCodes];

      let dateFilter = '';
      if (filters.dateFrom) {
        dateFilter += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        dateFilter += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        params.push(filters.dateTo);
      }

      // Conta leads únicos por status usando DISTINCT ON
      const result = await externalDb.raw<{ total: string; waiting: string }[]>({
        query: `
          WITH unique_leads AS (
            SELECT DISTINCT ON (cod_agent, session_id)
              session_id, state
            FROM followup_queue
            WHERE cod_agent IN (${agentPlaceholders})
              ${dateFilter}
            ORDER BY cod_agent, session_id, send_date DESC
          )
          SELECT 
            COUNT(*)::text as total,
            COUNT(*) FILTER (WHERE state = 'SEND')::text as waiting
          FROM unique_leads
        `,
        params,
      });

      const flatResult = Array.isArray(result) ? result.flat() : [];
      return {
        total: parseInt(flatResult[0]?.total || '0', 10),
        waiting: parseInt(flatResult[0]?.waiting || '0', 10),
      };
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 1000 * 30,
  });
}
```

#### B) Modificar `useFollowupResponseRate` (linhas 539-604)

Alterar para contar CADA resposta (não leads únicos):

```typescript
export function useFollowupResponseRate(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-response-rate', filters],
    queryFn: async () => {
      if (!filters.agentCodes.length) return { total: 0, responses: 0, rate: 0 };

      const agentPlaceholders = filters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      
      // 1. Total de leads únicos que receberam mensagem
      const historyParams: (string | number)[] = [...filters.agentCodes];
      let historyDateFilter = '';
      if (filters.dateFrom) {
        historyDateFilter += ` AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${historyParams.length + 1}`;
        historyParams.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        historyDateFilter += ` AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${historyParams.length + 1}`;
        historyParams.push(filters.dateTo);
      }

      const totalResult = await externalDb.raw<{ total: string }[]>({
        query: `
          SELECT COUNT(DISTINCT fq.session_id)::text as total
          FROM followup_history fh
          JOIN followup_queue fq ON fq.id = fh.followup_queue_id
          WHERE fq.cod_agent IN (${agentPlaceholders})
            ${historyDateFilter}
        `,
        params: historyParams,
      });

      // 2. Total de RESPOSTAS (COUNT(*), não DISTINCT)
      const responseParams: (string | number)[] = [...filters.agentCodes];
      let responseDateFilter = '';
      if (filters.dateFrom) {
        responseDateFilter += ` AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${responseParams.length + 1}`;
        responseParams.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        responseDateFilter += ` AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${responseParams.length + 1}`;
        responseParams.push(filters.dateTo);
      }

      const responseResult = await externalDb.raw<{ responses: string }[]>({
        query: `
          SELECT COUNT(*)::text as responses
          FROM followup_response fr
          JOIN followup_queue fq ON fq.id = fr.followup_queue_id
          WHERE fq.cod_agent IN (${agentPlaceholders})
            ${responseDateFilter}
        `,
        params: responseParams,
      });

      const total = parseInt(totalResult.flat()[0]?.total || '0', 10);
      const responses = parseInt(responseResult.flat()[0]?.responses || '0', 10);
      // Taxa = (respostas / leads contatados) * 100
      const rate = total > 0 ? (responses / total) * 100 : 0;

      return { total, responses, rate };
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 1000 * 30,
  });
}
```

#### C) Modificar `useFollowupDailyMetrics` (linhas 404-537)

Atualizar para contar respostas corretamente (`COUNT(*)` em vez de `COUNT(DISTINCT)`):

A query de `response_metrics` deve usar:
```sql
COUNT(*)::text as responses  -- Cada registro = 1 resposta
```

E adicionar CTE para métricas da fila:
```sql
queue_metrics AS (
  SELECT 
    (created_at AT TIME ZONE 'America/Sao_Paulo')::date as period,
    COUNT(DISTINCT session_id)::text as total_leads,
    COUNT(DISTINCT session_id) FILTER (WHERE state = 'SEND')::text as waiting_leads
  FROM followup_queue
  WHERE cod_agent IN (...)
    AND date_filter
  GROUP BY period
)
```

#### D) Modificar `useFollowupPreviousPeriodStats` (linhas 607-774)

Atualizar para:
1. Buscar `total` e `waiting` da `followup_queue` (não do history)
2. Contar respostas com `COUNT(*)` (não `DISTINCT`)

---

### 2. src/pages/agente/followup/FollowupPage.tsx

Atualizar `dashboardStats` para usar os novos dados:

```typescript
// Importar novo hook
import { useFollowupQueueTotals } from '../hooks/useFollowupData';

// Usar o novo hook
const { data: queueTotals } = useFollowupQueueTotals(dashboardFilters);

// Calcular dashboardStats corretamente
const dashboardStats: FollowupStats = useMemo(() => ({
  total: queueTotals?.total || 0,           // Da followup_queue
  waiting: queueTotals?.waiting || 0,       // state = 'SEND'
  totalSent: dailyMetrics.reduce((sum, d) => sum + d.messagesSent, 0),
  stopped: responseData?.responses || 0,    // COUNT(*) de followup_response
  responseRate: responseData?.rate || 0,
  previous: isLoadingPrevious ? undefined : previousStats,
}), [queueTotals, dailyMetrics, responseData, previousStats, isLoadingPrevious]);
```

---

### 3. src/pages/agente/types.ts

Atualizar comentários para refletir a nova lógica:

```typescript
export interface FollowupStats {
  total: number;           // Total de leads na fila (qualquer status)
  totalSent: number;       // Total de mensagens enviadas (followup_history)
  waiting: number;         // Leads com state = 'SEND' (ativos)
  stopped: number;         // Total de respostas (COUNT de followup_response)
  responseRate: number;    // (respostas / leads contatados) * 100
  previous?: FollowupPreviousStats;
}
```

---

## Fluxo de Dados Corrigido

```text
                    followup_queue
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
   Total na Fila                    Aguardando
   (DISTINCT session_id)            (WHERE state='SEND')
   qualquer status                  leads ativos
         │                               │
         └───────────────┬───────────────┘
                         │
                         ▼
                    Dashboard Cards
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
   followup_history  followup_response  Taxa
   (COUNT mensagens)  (COUNT respostas)  (resp/leads)*100
```

---

## Queries SQL Corrigidas

### Query: Total na Fila e Aguardando

```sql
WITH unique_leads AS (
  SELECT DISTINCT ON (cod_agent, session_id)
    session_id, state
  FROM followup_queue
  WHERE cod_agent IN ($1, $2, ...)
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $from
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $to
  ORDER BY cod_agent, session_id, send_date DESC
)
SELECT 
  COUNT(*)::text as total,
  COUNT(*) FILTER (WHERE state = 'SEND')::text as waiting
FROM unique_leads
```

### Query: Total de Respostas

```sql
SELECT COUNT(*)::text as responses
FROM followup_response fr
JOIN followup_queue fq ON fq.id = fr.followup_queue_id
WHERE fq.cod_agent IN ($1, $2, ...)
  AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $from
  AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $to
```

### Query: Taxa de Resposta

```sql
-- Numerador: Total de respostas (cada registro conta)
-- Denominador: Leads únicos que receberam pelo menos 1 mensagem

Taxa = (COUNT(*) FROM followup_response) / (COUNT(DISTINCT session_id) FROM followup_history) * 100
```

---

## Resumo das Correções

| Métrica | Antes | Depois |
|---------|-------|--------|
| **Leads na Fila** | Soma de `uniqueLeads` do history | `COUNT(DISTINCT session_id)` da queue |
| **Aguardando** | `uniqueLeads - stopped` | `COUNT(*) FILTER (WHERE state='SEND')` da queue |
| **Respostas** | `COUNT(DISTINCT session_id)` | `COUNT(*)` de followup_response |
| **Taxa** | leads que responderam / total | respostas / leads contatados |

---

## Ordem de Implementacao

1. Criar novo hook `useFollowupQueueTotals` em `useFollowupData.ts`
2. Modificar `useFollowupResponseRate` para usar `COUNT(*)` em respostas
3. Modificar `useFollowupDailyMetrics` para incluir métricas corretas
4. Modificar `useFollowupPreviousPeriodStats` para usar nova lógica
5. Atualizar `FollowupPage.tsx` para usar `useFollowupQueueTotals`
6. Atualizar comentários em `types.ts`
