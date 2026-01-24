

# Correção Taxa de Retorno + Novo Card Taxa de Perda

## Problema Identificado

A Taxa de Retorno atual considera qualquer lead que tenha registro em `followup_response`, mas a regra correta é:

| Métrica | Regra Correta |
|---------|---------------|
| **Taxa de Retorno** | Leads que responderam **E** estão com `state = 'STOP'` **E** `step_number <> 0` |
| **Taxa de Perda** | Leads com `state = 'STOP'` **E** `step_number = 0` (finalizados sem retorno) |

### Lógica de Negócio

- **Lead que retornou**: respondeu (tem registro em `followup_response`) e foi marcado como STOP com `step_number > 0` (conversa continuou)
- **Lead perdido**: foi finalizado (`state = 'STOP'` e `step_number = 0`) sem retorno efetivo

---

## Arquivos a Modificar

### 1. src/pages/agente/hooks/useFollowupData.ts

#### A) Modificar `useFollowupReturnRate` (linhas 589-675)

Adicionar condições `state = 'STOP'` e `step_number <> 0` na CTE:

```sql
WITH response_data AS (
  SELECT DISTINCT ON (fq.cod_agent, fq.session_id)
    fq.session_id
  FROM followup_queue fq
  INNER JOIN followup_response fr ON fr.followup_queue_id = fq.id
  WHERE fq.cod_agent IN (...)
    AND fq.state = 'STOP'
    AND fq.step_number <> 0
    AND [date_filters on fr.created_at]
  ORDER BY fq.cod_agent, fq.session_id, fr.created_at DESC
)
SELECT COUNT(*)::text as leads_returned FROM response_data
```

E adicionar query para **leads perdidos** (Taxa de Perda):

```sql
-- Leads finalizados (STOP + step_number = 0)
WITH lost_leads AS (
  SELECT DISTINCT ON (fq.cod_agent, fq.session_id)
    fq.session_id
  FROM followup_queue fq
  WHERE fq.cod_agent IN (...)
    AND fq.state = 'STOP'
    AND fq.step_number = 0
    AND [date_filters on fq.created_at]
  ORDER BY fq.cod_agent, fq.session_id, fq.send_date DESC
)
SELECT COUNT(*)::text as leads_lost FROM lost_leads
```

**Retorno atualizado do hook:**
```typescript
return { 
  totalLeads,      // Total na fila
  leadsReturned,   // Leads que retornaram (STOP + step <> 0 + resposta)
  leadsLost,       // Leads perdidos (STOP + step = 0)
  responses,       // Total de respostas COUNT(*)
  returnRate,      // (leadsReturned / totalLeads) * 100
  lossRate,        // (leadsLost / totalLeads) * 100
};
```

#### B) Modificar `useFollowupPreviousPeriodStats` (linhas 730-812)

Aplicar mesma lógica para período anterior, incluindo `leadsLost` e `lossRate`.

---

### 2. src/pages/agente/types.ts

Adicionar novos campos às interfaces:

```typescript
export interface FollowupStats {
  total: number;           // Total de leads na fila (qualquer status)
  totalSent: number;       // Total de mensagens enviadas
  waiting: number;         // Leads com state = 'SEND' (ativos)
  stopped: number;         // Total de respostas COUNT(*) - followup_response
  responseRate: number;    // Taxa de Retorno = (leads STOP + step<>0 com resposta / total) × 100
  lossRate: number;        // Taxa de Perda = (leads STOP + step=0 / total) × 100
  previous?: FollowupPreviousStats;
}

export interface FollowupPreviousStats {
  total: number;
  totalSent: number;
  waiting: number;
  stopped: number;
  responseRate: number;
  lossRate: number;        // Novo campo
}
```

---

### 3. src/pages/agente/followup/components/FollowupSummary.tsx

Adicionar novo card "Taxa de Perda" ao array de cards:

```typescript
const cards: CardData[] = [
  // ... cards existentes ...
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
    title: 'Taxa de Perda',
    value: `${stats.lossRate.toFixed(1)}%`,
    icon: TrendingDown,  // Novo ícone
    color: 'text-red-600',
    bgColor: 'bg-red-500/10',
    change: stats.previous 
      ? calculatePpChange(stats.lossRate, stats.previous.lossRate) 
      : null,
    invertChange: true,  // Queda é positiva para perda
  },
];
```

Atualizar grid para 6 colunas:
```tsx
<div className="grid grid-cols-2 md:grid-cols-6 gap-4">
```

---

### 4. src/pages/agente/followup/FollowupPage.tsx

Atualizar `dashboardStats` para incluir `lossRate`:

```typescript
const dashboardStats: FollowupStats = useMemo(() => ({
  total: queueTotals?.total || 0,
  totalSent: dailyMetrics.reduce((sum, d) => sum + d.messagesSent, 0),
  waiting: queueTotals?.waiting || 0,
  stopped: returnData?.responses || 0,
  responseRate: returnData?.returnRate || 0,
  lossRate: returnData?.lossRate || 0,           // Novo campo
  previous: isLoadingPrevious ? undefined : previousStats,
}), [queueTotals, dailyMetrics, returnData, previousStats, isLoadingPrevious]);
```

---

## Fluxo de Dados Corrigido

```text
                    followup_queue
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
   Total na Fila    Aguardando      Finalizados
   (DISTINCT)       (state=SEND)    (state=STOP)
                                         │
                         ┌───────────────┴───────────────┐
                         │                               │
                         ▼                               ▼
                   step_number <> 0               step_number = 0
                   (com resposta?)                 (sem retorno)
                         │                               │
                         │                               │
           JOIN followup_response                        │
                         │                               │
                         ▼                               ▼
                 Leads Retornaram                  Leads Perdidos
                 (STOP + step<>0 + resp)           (STOP + step=0)
                         │                               │
                         ▼                               ▼
                   Taxa de Retorno               Taxa de Perda
                   (returned/total)%             (lost/total)%
```

---

## Queries SQL Principais

### Query: Leads que Retornaram

```sql
WITH response_data AS (
  SELECT DISTINCT ON (fq.cod_agent, fq.session_id)
    fq.session_id
  FROM followup_queue fq
  INNER JOIN followup_response fr ON fr.followup_queue_id = fq.id
  WHERE fq.cod_agent IN ($1, $2, ...)
    AND fq.state = 'STOP'
    AND fq.step_number <> 0
    AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $from
    AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $to
  ORDER BY fq.cod_agent, fq.session_id, fr.created_at DESC
)
SELECT COUNT(*)::text as leads_returned FROM response_data
```

### Query: Leads Perdidos

```sql
WITH lost_leads AS (
  SELECT DISTINCT ON (fq.cod_agent, fq.session_id)
    fq.session_id
  FROM followup_queue fq
  WHERE fq.cod_agent IN ($1, $2, ...)
    AND fq.state = 'STOP'
    AND fq.step_number = 0
    AND (fq.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $from
    AND (fq.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $to
  ORDER BY fq.cod_agent, fq.session_id, fq.send_date DESC
)
SELECT COUNT(*)::text as leads_lost FROM lost_leads
```

---

## Resumo das Métricas

| Card | Fórmula | Cor |
|------|---------|-----|
| **Taxa de Retorno** | (leads STOP + step<>0 com resposta / total fila) × 100 | Roxo |
| **Taxa de Perda** | (leads STOP + step=0 / total fila) × 100 | Vermelho |

---

## Seção Técnica

### Ordem de Implementação

1. Atualizar interfaces em `types.ts` (adicionar `lossRate`)
2. Modificar `useFollowupReturnRate` em `useFollowupData.ts`:
   - Adicionar condições `state = 'STOP'` e `step_number <> 0` na query de retorno
   - Adicionar nova query para leads perdidos
   - Retornar `lossRate` calculado
3. Modificar `useFollowupPreviousPeriodStats` com mesma lógica
4. Atualizar `FollowupPage.tsx` para usar `lossRate`
5. Adicionar card "Taxa de Perda" em `FollowupSummary.tsx`
6. Ajustar grid de 5 para 6 colunas

### Considerações de Performance

As queries adicionam filtros `state = 'STOP'` que podem utilizar índice existente na coluna `state`. Recomenda-se índice composto:

```sql
CREATE INDEX idx_followup_queue_agent_state_step 
ON followup_queue(cod_agent, state, step_number);
```

