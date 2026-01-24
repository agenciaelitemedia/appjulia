

# Plano: Corrigir Cálculo de FollowUps Enviados

## Entendimento da Regra

A contagem de mensagens enviadas deve ser baseada no `step_number` de cada registro:

| Registro | step_number | state | Mensagens Enviadas |
|----------|-------------|-------|-------------------|
| Lead A   | 4           | QUEUE | 3 (etapas 1,2,3)  |
| Lead B   | 5           | SEND  | 5 (etapas 1,2,3,4,5) |
| Lead C   | 2           | STOP  | 1 (etapa 1)       |
| **Total**|             |       | **9 mensagens**   |

### Fórmula
- Se `state = 'SEND'`: mensagens enviadas = `step_number` (a etapa atual foi enviada)
- Se `state = 'QUEUE'` ou `state = 'STOP'`: mensagens enviadas = `step_number - 1` (aguardando ou parou antes de enviar)

---

## Alteração

### src/pages/agente/hooks/useFollowupData.ts

Atualizar a query `useFollowupSentCount` para calcular a soma baseada no step_number:

```sql
SELECT COALESCE(SUM(
  CASE 
    WHEN state = 'SEND' THEN step_number
    ELSE GREATEST(step_number - 1, 0)
  END
), 0)::text as total
FROM followup_queue
WHERE cod_agent IN ($agentCodes)
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $dateFrom
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $dateTo
```

---

## Exemplo Prático

Tabela `followup_queue`:
```text
| id | session_id | step_number | state |
|----|------------|-------------|-------|
| 1  | lead_a     | 1           | SEND  |  → 1 msg
| 2  | lead_a     | 2           | SEND  |  → 2 msgs
| 3  | lead_a     | 3           | QUEUE |  → 2 msgs (aguardando a 3ª)
| 4  | lead_b     | 1           | SEND  |  → 1 msg
| 5  | lead_b     | 2           | SEND  |  → 2 msgs
| 6  | lead_c     | 1           | SEND  |  → 1 msg
| 7  | lead_c     | 2           | STOP  |  → 1 msg (parou antes de enviar)
```

**Total de mensagens enviadas**: 1 + 2 + 2 + 1 + 2 + 1 + 1 = **10 mensagens**

---

## Código Atualizado

```typescript
export function useFollowupSentCount(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-sent-count', filters],
    queryFn: async () => {
      if (!filters.agentCodes.length) return 0;

      const agentPlaceholders = filters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      const params: (string | number)[] = [...filters.agentCodes];

      let whereClause = `cod_agent IN (${agentPlaceholders})`;

      // Date filters
      if (filters.dateFrom) {
        whereClause += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        params.push(filters.dateTo);
      }

      // Soma das mensagens enviadas baseado no step_number
      // SEND = step_number (etapa atual foi enviada)
      // QUEUE/STOP = step_number - 1 (aguardando ou parou antes de enviar)
      const result = await externalDb.raw<{ total: string }[]>({
        query: `
          SELECT COALESCE(SUM(
            CASE 
              WHEN state = 'SEND' THEN step_number
              ELSE GREATEST(step_number - 1, 0)
            END
          ), 0)::text as total
          FROM followup_queue
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

## Validação

A query usa:
- `SUM()` em vez de `COUNT()` para somar os valores
- `CASE WHEN` para aplicar a lógica de acordo com o state
- `GREATEST(step_number - 1, 0)` para garantir que nunca seja negativo (etapa 1 → 0 mensagens se não enviou)
- `COALESCE(..., 0)` para retornar 0 se não houver registros

