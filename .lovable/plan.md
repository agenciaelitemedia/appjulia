
# Plano: Contagem de Mensagens via followup_history

## Resumo
Alterar a lógica de contagem de "Mensagens Enviadas" para buscar o total de registros na tabela `followup_history`, onde cada registro representa uma execução real de envio de mensagem.

---

## Mudança Conceitual

| Antes (followup_queue) | Depois (followup_history) |
|------------------------|---------------------------|
| Calculado via step_number | Contagem direta de registros |
| `SUM(CASE WHEN state='SEND' THEN step_number ELSE step_number-1)` | `COUNT(*) FROM followup_history` |

---

## Arquivos a Modificar

### 1. src/pages/agente/hooks/useFollowupData.ts

#### A) Modificar `useFollowupSentCount` (linhas 8-52)

Alterar a query para contar registros de `followup_history` em vez de calcular via `followup_queue`:

```typescript
// Antes: Query em followup_queue com cálculo de step_number
// Depois: COUNT(*) em followup_history

export function useFollowupSentCount(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-sent-count', filters],
    queryFn: async () => {
      if (!filters.agentCodes.length) return 0;

      const agentPlaceholders = filters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      const params: (string | number)[] = [...filters.agentCodes];

      let whereClause = `fq.cod_agent IN (${agentPlaceholders})`;

      // Date filters (baseado em followup_history.created_at)
      if (filters.dateFrom) {
        whereClause += ` AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause += ` AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        params.push(filters.dateTo);
      }

      // Conta cada registro de followup_history como 1 mensagem enviada
      const result = await externalDb.raw<{ total: string }[]>({
        query: `
          SELECT COUNT(*)::text as total
          FROM followup_history fh
          JOIN followup_queue fq ON fq.id = fh.followup_queue_id
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

---

#### B) Modificar `useFollowupDailyMetrics` (linhas 407-514)

Alterar o cálculo de `messages_sent` para contar registros de `followup_history` por período:

```typescript
// Dentro da query, substituir:

// Antes:
COALESCE(SUM(
  CASE 
    WHEN state = 'SEND' THEN step_number
    ELSE GREATEST(step_number - 1, 0)
  END
), 0)::text as messages_sent

// Depois: Subquery para contar de followup_history
(
  SELECT COUNT(*)
  FROM followup_history fh
  WHERE fh.followup_queue_id = fq.id
    AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date = ...
)::text as messages_sent
```

A abordagem mais eficiente é fazer um JOIN com agregação:

```typescript
const result = await externalDb.raw<{
  date?: string;
  hour?: number;
  total_records: string;
  messages_sent: string;
  stopped: string;
  unique_leads: string;
}[]>({
  query: `
    WITH history_counts AS (
      SELECT 
        fh.followup_queue_id,
        ${isSingleDay 
          ? `EXTRACT(HOUR FROM fh.created_at AT TIME ZONE 'America/Sao_Paulo')::int as period`
          : `(fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date as period`
        },
        COUNT(*) as msg_count
      FROM followup_history fh
      JOIN followup_queue fq ON fq.id = fh.followup_queue_id
      WHERE fq.cod_agent IN (${agentPlaceholders})
        AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $date_from
        AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $date_to
      GROUP BY fh.followup_queue_id, period
    )
    SELECT 
      ${selectClause},
      COUNT(*)::text as total_records,
      COALESCE(SUM(hc.msg_count), 0)::text as messages_sent,
      COUNT(*) FILTER (WHERE state = 'STOP')::text as stopped,
      COUNT(DISTINCT session_id)::text as unique_leads
    FROM followup_queue fq
    LEFT JOIN history_counts hc ON hc.followup_queue_id = fq.id 
      AND hc.period = ${groupByClause}
    WHERE ${whereClause}
    GROUP BY ${groupByClause}
    ORDER BY ${orderClause}
  `,
  params,
});
```

---

## Estrutura da Tabela followup_history

```sql
CREATE TABLE followup_history (
    id bigint NOT NULL,
    followup_queue_id bigint,        -- FK para followup_queue.id
    step_number smallint,            -- Qual etapa foi executada
    created_at timestamp DEFAULT now() -- Quando a mensagem foi enviada
);
```

---

## Fluxo de Dados Atualizado

```text
Dashboard Summary
    │
    ├── "Mensagens Enviadas" ─────────────────────────────────────┐
    │                                                              │
    │   ANTES:                                                     │
    │   followup_queue.step_number (calculado)                     │
    │                                                              │
    │   DEPOIS:                                                    │
    │   COUNT(*) FROM followup_history                             │
    │   WHERE created_at BETWEEN dateFrom AND dateTo               │
    └──────────────────────────────────────────────────────────────┘

Evolution Chart
    │
    ├── "Mensagens Enviadas" por dia/hora ────────────────────────┐
    │                                                              │
    │   DEPOIS:                                                    │
    │   COUNT(*) FROM followup_history                             │
    │   GROUP BY (created_at)::date ou EXTRACT(HOUR)               │
    └──────────────────────────────────────────────────────────────┘
```

---

## Ordem de Implementação

1. **useFollowupSentCount** - Alterar query para contar de followup_history com JOIN em followup_queue (para filtro de cod_agent)

2. **useFollowupDailyMetrics** - Alterar cálculo de messages_sent para usar followup_history com agregação temporal

---

## Seção Técnica

### Query para useFollowupSentCount

```sql
SELECT COUNT(*)::text as total
FROM followup_history fh
JOIN followup_queue fq ON fq.id = fh.followup_queue_id
WHERE fq.cod_agent IN ($1, $2, ...)
  AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $date_from
  AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $date_to
```

### Query para useFollowupDailyMetrics (granularidade diária)

```sql
SELECT 
  (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date as date,
  COUNT(*)::text as messages_sent
FROM followup_history fh
JOIN followup_queue fq ON fq.id = fh.followup_queue_id
WHERE fq.cod_agent IN ($1, $2, ...)
  AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $date_from
  AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $date_to
GROUP BY (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date
ORDER BY date
```

### Query para useFollowupDailyMetrics (granularidade horária)

```sql
SELECT 
  EXTRACT(HOUR FROM fh.created_at AT TIME ZONE 'America/Sao_Paulo')::int as hour,
  COUNT(*)::text as messages_sent
FROM followup_history fh
JOIN followup_queue fq ON fq.id = fh.followup_queue_id
WHERE fq.cod_agent IN ($1, $2, ...)
  AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date = $date
GROUP BY EXTRACT(HOUR FROM fh.created_at AT TIME ZONE 'America/Sao_Paulo')
ORDER BY hour
```

---

## Considerações

- O filtro de data agora é aplicado em `followup_history.created_at` (quando a mensagem foi efetivamente enviada)
- O filtro de `cod_agent` continua via JOIN com `followup_queue`
- Registros em `followup_history` sem correspondência em `followup_queue` serão ignorados (JOIN)
