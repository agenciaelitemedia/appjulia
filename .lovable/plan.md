

# Novo Card "Taxa de Intervenção"

## Contexto

A análise dos dados revelou que existe uma **quarta categoria** de leads não contabilizada:

| Estado | Condição | Categoria | % Atual |
|--------|----------|-----------|---------|
| `SEND` | - | Taxa em FollowUp | 46.2% |
| `STOP` | `step_number <> 0` + **COM resposta** | Taxa de Retorno | 23.1% |
| `STOP` | `step_number = 0` | Taxa de Perda | 0.0% |
| `STOP` | `step_number <> 0` + **SEM resposta** | ❌ Não categorizado | **30.7%** |

Esses leads (30.7%) foram **parados por intervenção humana** antes de receberem uma resposta do cliente.

---

## Solução

Criar um novo card **"Taxa de Intervenção"** que contabiliza leads parados manualmente:

```text
                    Total de Leads na Fila = 100%
                             │
     ┌───────────────┬───────┴───────┬───────────────┬───────────────┐
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
  SEND          STOP+step<>0    STOP+step<>0     STOP+step=0
               COM resposta     SEM resposta
     │               │               │               │
     ▼               ▼               ▼               ▼
 Em FollowUp     Retorno        Intervenção        Perda
  (46.2%)       (23.1%)         (30.7%)           (0.0%)
     │               │               │               │
     └───────────────┴───────────────┴───────────────┘
                             │
                             ▼
                    SOMA = 100% ✓
```

---

## Arquivos a Modificar

### 1. src/pages/agente/types.ts

Adicionar `interventionRate` às interfaces:

```typescript
export interface FollowupPreviousStats {
  total: number;
  totalSent: number;
  waiting: number;
  stopped: number;
  responseRate: number;
  lossRate: number;
  followupRate: number;
  interventionRate: number;    // NOVO
}

export interface FollowupStats {
  total: number;
  totalSent: number;
  waiting: number;
  stopped: number;
  responseRate: number;
  lossRate: number;
  followupRate: number;
  interventionRate: number;    // NOVO
  previous?: FollowupPreviousStats;
}
```

---

### 2. src/pages/agente/hooks/useFollowupData.ts

#### A) Modificar `useFollowupReturnRate` (linhas 630-700)

Adicionar novo campo `intervention` na query SQL:

```sql
WITH current_state AS (
  SELECT DISTINCT ON (cod_agent, session_id)
    session_id, id as queue_id, state, step_number
  FROM followup_queue
  WHERE cod_agent IN (...)
  ORDER BY cod_agent, session_id, send_date DESC
),
leads_with_response AS (
  SELECT DISTINCT cs.session_id
  FROM current_state cs
  INNER JOIN followup_response fr ON fr.followup_queue_id = cs.queue_id
  WHERE cs.state = 'STOP'
)
SELECT 
  COUNT(*)::text as total_leads,
  COUNT(*) FILTER (WHERE state = 'SEND')::text as in_followup,
  
  -- Retorno: STOP + step<>0 + COM resposta
  COUNT(*) FILTER (
    WHERE state = 'STOP' 
      AND step_number <> 0 
      AND session_id IN (SELECT session_id FROM leads_with_response)
  )::text as returned,
  
  -- NOVO: Intervenção: STOP + step<>0 + SEM resposta
  COUNT(*) FILTER (
    WHERE state = 'STOP' 
      AND step_number <> 0 
      AND session_id NOT IN (SELECT session_id FROM leads_with_response)
  )::text as intervention,
  
  -- Perda: STOP + step=0
  COUNT(*) FILTER (WHERE state = 'STOP' AND step_number = 0)::text as lost,
  
  ...
FROM current_state;
```

Adicionar ao retorno:

```typescript
const intervention = parseInt(flatResult[0]?.intervention || '0', 10);

return {
  totalLeads,
  leadsInFollowup: inFollowup,
  leadsReturned: returned,
  leadsIntervention: intervention,   // NOVO
  leadsLost: lost,
  responses,
  followupRate: totalLeads > 0 ? (inFollowup / totalLeads) * 100 : 0,
  returnRate: totalLeads > 0 ? (returned / totalLeads) * 100 : 0,
  interventionRate: totalLeads > 0 ? (intervention / totalLeads) * 100 : 0,  // NOVO
  lossRate: totalLeads > 0 ? (lost / totalLeads) * 100 : 0,
};
```

#### B) Modificar `useFollowupPreviousPeriodStats` (linhas 800-867)

Aplicar mesma lógica para período anterior, incluindo `intervention` e `interventionRate`.

---

### 3. src/pages/agente/followup/FollowupPage.tsx

Atualizar `dashboardStats` para incluir `interventionRate`:

```typescript
const dashboardStats: FollowupStats = useMemo(() => ({
  total: returnData?.totalLeads || 0,
  waiting: returnData?.leadsInFollowup || 0,
  totalSent: dailyMetrics.reduce((sum, d) => sum + d.messagesSent, 0),
  stopped: returnData?.responses || 0,
  followupRate: returnData?.followupRate || 0,
  responseRate: returnData?.returnRate || 0,
  interventionRate: returnData?.interventionRate || 0,   // NOVO
  lossRate: returnData?.lossRate || 0,
  previous: isLoadingPrevious ? undefined : previousStats,
}), [dailyMetrics, returnData, previousStats, isLoadingPrevious]);
```

---

### 4. src/pages/agente/followup/components/FollowupSummary.tsx

Adicionar card "Taxa de Intervenção" na segunda linha (taxas percentuais):

```typescript
import { HandStop } from 'lucide-react';  // Ícone de mão para intervenção

// Cards da segunda linha (taxas percentuais) - agora com 4 cards
const rateCards: CardData[] = [
  {
    title: 'Taxa em FollowUp',
    value: `${stats.followupRate.toFixed(1)}%`,
    icon: Users,
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10',
    change: stats.previous 
      ? calculatePpChange(stats.followupRate, stats.previous.followupRate) 
      : null,
  },
  {
    title: 'Taxa de Retorno',
    value: `${stats.responseRate.toFixed(1)}%`,
    icon: TrendingUp,
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10',
    change: stats.previous 
      ? calculatePpChange(stats.responseRate, stats.previous.responseRate) 
      : null,
  },
  {
    title: 'Taxa de Intervenção',    // NOVO CARD
    value: `${stats.interventionRate.toFixed(1)}%`,
    icon: HandStop,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    change: stats.previous 
      ? calculatePpChange(stats.interventionRate, stats.previous.interventionRate) 
      : null,
  },
  {
    title: 'Taxa de Perda',
    value: `${stats.lossRate.toFixed(1)}%`,
    icon: TrendingDown,
    color: 'text-red-600',
    bgColor: 'bg-red-500/10',
    change: stats.previous 
      ? calculatePpChange(stats.lossRate, stats.previous.lossRate) 
      : null,
    invertChange: true,
  },
];
```

Atualizar grid para 4 colunas:

```tsx
{/* Linha 2: Taxas Percentuais */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {rateCards.map((card, index) => renderCard(card, index))}
</div>
```

---

## Layout Final

| Linha | Cards | Grid |
|-------|-------|------|
| **Linha 1** | Leads na Fila, Leads em FollowUp, Mensagens Enviadas, Respostas | 4 colunas |
| **Linha 2** | Taxa em FollowUp, Taxa de Retorno, Taxa de Intervenção, Taxa de Perda | 4 colunas |

---

## Resumo das Métricas

| Card | Regra | Cor |
|------|-------|-----|
| **Taxa em FollowUp** | `state = 'SEND'` | Laranja |
| **Taxa de Retorno** | `state = 'STOP'` + `step <> 0` + COM resposta | Roxo |
| **Taxa de Intervenção** | `state = 'STOP'` + `step <> 0` + SEM resposta | Âmbar |
| **Taxa de Perda** | `state = 'STOP'` + `step = 0` | Vermelho |

**Soma: 100%** ✓

---

## Seção Técnica

### Query SQL Completa

```sql
WITH current_state AS (
  SELECT DISTINCT ON (cod_agent, session_id)
    session_id, id as queue_id, state, step_number
  FROM followup_queue
  WHERE cod_agent IN ($1, $2, ...)
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $from
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $to
  ORDER BY cod_agent, session_id, send_date DESC
),
leads_with_response AS (
  SELECT DISTINCT cs.session_id
  FROM current_state cs
  INNER JOIN followup_response fr ON fr.followup_queue_id = cs.queue_id
  WHERE cs.state = 'STOP'
)
SELECT 
  COUNT(*)::text as total_leads,
  COUNT(*) FILTER (WHERE state = 'SEND')::text as in_followup,
  COUNT(*) FILTER (
    WHERE state = 'STOP' AND step_number <> 0 
      AND session_id IN (SELECT session_id FROM leads_with_response)
  )::text as returned,
  COUNT(*) FILTER (
    WHERE state = 'STOP' AND step_number <> 0 
      AND session_id NOT IN (SELECT session_id FROM leads_with_response)
  )::text as intervention,
  COUNT(*) FILTER (WHERE state = 'STOP' AND step_number = 0)::text as lost,
  (SELECT COUNT(*)::text FROM followup_response fr
   JOIN followup_queue fq ON fq.id = fr.followup_queue_id
   WHERE fq.cod_agent IN ($1, $2, ...) [response_date_filter]
  ) as total_responses
FROM current_state;
```

### Ordem de Implementação

1. Atualizar interfaces em `types.ts` (adicionar `interventionRate`)
2. Modificar `useFollowupReturnRate` com novo campo `intervention`
3. Modificar `useFollowupPreviousPeriodStats` com mesma lógica
4. Atualizar `FollowupPage.tsx` para usar `interventionRate`
5. Adicionar card "Taxa de Intervenção" em `FollowupSummary.tsx`
6. Ajustar grid de 3 para 4 colunas na segunda linha

### Validação

Após implementação, verificar que:
- `Taxa em FollowUp + Taxa de Retorno + Taxa de Intervenção + Taxa de Perda = 100%`
- Cada lead é contado em exatamente uma categoria

