

# Correção das Taxas Percentuais - Análise e Solução

## Problema Identificado

A soma das taxas está ultrapassando 100% porque as métricas **não são mutuamente exclusivas** como deveriam:

```text
Taxa em FollowUp: 64.9%
Taxa de Retorno:  55.1%
Taxa de Perda:     0.5%
─────────────────────────
TOTAL:           120.5% ❌
```

### Diagnóstico Técnico

As três taxas usam **critérios de seleção diferentes** que permitem sobreposição:

| Taxa | Critério de Seleção | Problema |
|------|---------------------|----------|
| **Taxa em FollowUp** | `DISTINCT ON(session_id)` pega o **registro mais recente** com `state = 'SEND'` | OK |
| **Taxa de Retorno** | JOIN com `followup_response` onde `state = 'STOP'` e `step <> 0` | **NÃO usa DISTINCT ON para pegar o estado mais recente** |
| **Taxa de Perda** | `state = 'STOP'` e `step = 0` | **NÃO usa DISTINCT ON para pegar o estado mais recente** |

### Causa Raiz

A query da **Taxa de Retorno** (linhas 641-658) faz:

```sql
SELECT DISTINCT ON (fq.cod_agent, fq.session_id)
  fq.session_id
FROM followup_queue fq
INNER JOIN followup_response fr ON fr.followup_queue_id = fq.id
WHERE fq.state = 'STOP' AND fq.step_number <> 0
ORDER BY fq.cod_agent, fq.session_id, fr.created_at DESC
```

O problema: o `DISTINCT ON` está ordenando por `fr.created_at`, não por `fq.send_date`. Isso significa que:
- Um lead pode ter **múltiplos registros** na `followup_queue` com estados diferentes
- A query pega **qualquer registro histórico** que tenha `state = 'STOP'`, não necessariamente o **estado atual**
- Se o lead foi STOP no passado mas agora está SEND novamente, ele conta em **ambas as métricas**

### Exemplo do Problema

```text
Lead "João" tem 3 registros em followup_queue:
┌────────────┬───────┬─────────────┬────────────┐
│ session_id │ state │ step_number │ send_date  │
├────────────┼───────┼─────────────┼────────────┤
│ joao123    │ STOP  │ 2           │ 2025-01-20 │  ← Taxa de Retorno o conta (estado antigo)
│ joao123    │ SEND  │ 1           │ 2025-01-22 │  ← Taxa em FollowUp o conta (mais recente)
│ joao123    │ SEND  │ 2           │ 2025-01-24 │  ← Este é o estado ATUAL
└────────────┴───────┴─────────────┴────────────┘

Resultado: João é contado em AMBAS as taxas!
```

---

## Solução Proposta

As três taxas devem ser **mutuamente exclusivas** e somar exatamente 100%:

```text
                    Total de Leads na Fila
                           (100%)
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
   state = 'SEND'     state = 'STOP'      state = 'STOP'
                      step_number <> 0     step_number = 0
                      (COM resposta)
         │                   │                   │
         ▼                   ▼                   ▼
   Taxa em FollowUp    Taxa de Retorno    Taxa de Perda
```

### Lógica Corrigida

Todas as taxas devem considerar apenas o **estado mais recente** de cada lead:

```sql
-- CTE base para pegar o estado ATUAL de cada lead
WITH current_state AS (
  SELECT DISTINCT ON (cod_agent, session_id)
    session_id,
    state,
    step_number
  FROM followup_queue
  WHERE cod_agent IN (...)
    AND [date_filters]
  ORDER BY cod_agent, session_id, send_date DESC  -- Estado mais recente
)
```

Depois, as três taxas são calculadas a partir dessa CTE:

| Taxa | Filtro na CTE |
|------|---------------|
| **Taxa em FollowUp** | `WHERE state = 'SEND'` |
| **Taxa de Retorno** | `WHERE state = 'STOP' AND step_number <> 0` + verificar se tem resposta |
| **Taxa de Perda** | `WHERE state = 'STOP' AND step_number = 0` |

---

## Arquivos a Modificar

### 1. src/pages/agente/hooks/useFollowupData.ts

#### Modificar `useFollowupReturnRate` (linhas 592-716)

Refatorar para usar uma **única CTE base** que determina o estado atual de cada lead:

```typescript
export function useFollowupReturnRate(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-return-rate', filters],
    queryFn: async () => {
      // ... validações ...

      // Query unificada que calcula todas as métricas a partir do estado ATUAL
      const result = await externalDb.raw<{
        total_leads: string;
        in_followup: string;
        returned: string;
        lost: string;
        total_responses: string;
      }[]>({
        query: `
          WITH current_state AS (
            -- Estado ATUAL de cada lead (registro mais recente)
            SELECT DISTINCT ON (cod_agent, session_id)
              session_id,
              id as queue_id,
              state,
              step_number
            FROM followup_queue
            WHERE cod_agent IN (${agentPlaceholders})
              ${dateFilter}
            ORDER BY cod_agent, session_id, send_date DESC
          ),
          with_response AS (
            -- Leads em STOP que têm resposta registrada
            SELECT DISTINCT cs.session_id
            FROM current_state cs
            INNER JOIN followup_response fr ON fr.followup_queue_id = cs.queue_id
            WHERE cs.state = 'STOP'
          )
          SELECT 
            COUNT(*)::text as total_leads,
            COUNT(*) FILTER (WHERE state = 'SEND')::text as in_followup,
            COUNT(*) FILTER (
              WHERE state = 'STOP' 
                AND step_number <> 0 
                AND session_id IN (SELECT session_id FROM with_response)
            )::text as returned,
            COUNT(*) FILTER (
              WHERE state = 'STOP' AND step_number = 0
            )::text as lost,
            (SELECT COUNT(*)::text FROM followup_response fr
             JOIN followup_queue fq ON fq.id = fr.followup_queue_id
             WHERE fq.cod_agent IN (${agentPlaceholders})
               ${responseFilter}
            ) as total_responses
          FROM current_state
        `,
        params,
      });

      const totalLeads = parseInt(result.flat()[0]?.total_leads || '0', 10);
      const inFollowup = parseInt(result.flat()[0]?.in_followup || '0', 10);
      const returned = parseInt(result.flat()[0]?.returned || '0', 10);
      const lost = parseInt(result.flat()[0]?.lost || '0', 10);
      const responses = parseInt(result.flat()[0]?.total_responses || '0', 10);

      return {
        totalLeads,
        leadsInFollowup: inFollowup,
        leadsReturned: returned,
        leadsLost: lost,
        responses,
        followupRate: totalLeads > 0 ? (inFollowup / totalLeads) * 100 : 0,
        returnRate: totalLeads > 0 ? (returned / totalLeads) * 100 : 0,
        lossRate: totalLeads > 0 ? (lost / totalLeads) * 100 : 0,
      };
    },
    // ...
  });
}
```

### 2. src/pages/agente/followup/FollowupPage.tsx

Atualizar `dashboardStats` para usar as métricas unificadas:

```typescript
const dashboardStats: FollowupStats = useMemo(() => ({
  total: returnData?.totalLeads || 0,
  waiting: returnData?.leadsInFollowup || 0,
  totalSent: dailyMetrics.reduce((sum, d) => sum + d.messagesSent, 0),
  stopped: returnData?.responses || 0,
  followupRate: returnData?.followupRate || 0,
  responseRate: returnData?.returnRate || 0,
  lossRate: returnData?.lossRate || 0,
  previous: isLoadingPrevious ? undefined : previousStats,
}), [dailyMetrics, returnData, previousStats, isLoadingPrevious]);
```

### 3. src/pages/agente/hooks/useFollowupData.ts - `useFollowupPreviousPeriodStats`

Aplicar a mesma lógica unificada para o período anterior.

---

## Resultado Esperado

Após a correção, as taxas serão mutuamente exclusivas:

```text
                    Total de Leads na Fila = 100%
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
   Taxa em FollowUp    Taxa de Retorno    Taxa de Perda
      (SEND)          (STOP + step<>0)   (STOP + step=0)
         │                   │                   │
         └───────────────────┴───────────────────┘
                             │
                             ▼
                    SOMA = 100% ✓
```

---

## Seção Técnica

### Query SQL Corrigida

```sql
WITH current_state AS (
  -- Pega o registro MAIS RECENTE de cada lead
  SELECT DISTINCT ON (cod_agent, session_id)
    session_id,
    id as queue_id,
    state,
    step_number
  FROM followup_queue
  WHERE cod_agent IN ($1, $2, ...)
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $from
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $to
  ORDER BY cod_agent, session_id, send_date DESC
),
leads_with_response AS (
  -- Identifica quais leads em STOP têm resposta registrada
  SELECT DISTINCT cs.session_id
  FROM current_state cs
  INNER JOIN followup_response fr ON fr.followup_queue_id = cs.queue_id
  WHERE cs.state = 'STOP'
)
SELECT 
  COUNT(*)::text as total_leads,
  
  -- Taxa em FollowUp: leads atualmente em SEND
  COUNT(*) FILTER (WHERE state = 'SEND')::text as in_followup,
  
  -- Taxa de Retorno: leads em STOP + step<>0 + tem resposta
  COUNT(*) FILTER (
    WHERE state = 'STOP' 
      AND step_number <> 0 
      AND session_id IN (SELECT session_id FROM leads_with_response)
  )::text as returned,
  
  -- Taxa de Perda: leads em STOP + step=0
  COUNT(*) FILTER (WHERE state = 'STOP' AND step_number = 0)::text as lost
  
FROM current_state;
```

### Ordem de Implementação

1. Refatorar `useFollowupReturnRate` com a CTE unificada
2. Remover dependência de `useFollowupQueueTotals` (dados virão do hook unificado)
3. Atualizar `useFollowupPreviousPeriodStats` com mesma lógica
4. Ajustar `FollowupPage.tsx` para consumir o novo formato de dados
5. Testar para confirmar que a soma das taxas = 100%

### Validação

Após implementação, verificar:
- `Taxa em FollowUp + Taxa de Retorno + Taxa de Perda ≈ 100%` (pode haver pequena diferença por leads em transição)
- Nenhum lead é contado em mais de uma categoria

