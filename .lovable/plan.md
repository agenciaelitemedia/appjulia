

# Correção: Taxa de Intervenção Sempre Vazia

## Problema Identificado

A query da CTE `leads_with_response` está fazendo o JOIN errado. Ela busca respostas apenas no registro **mais recente** de cada lead, mas a resposta pode estar vinculada a um **registro anterior** do mesmo `session_id`.

### Cenário do Bug

```text
Lead "João" (session_id: 5511999999999):
┌────────┬───────┬─────────────┬────────────┐
│   id   │ state │ step_number │ send_date  │
├────────┼───────┼─────────────┼────────────┤
│   100  │ SEND  │ 1           │ 2026-01-20 │  ← Resposta vinculada aqui (followup_response.followup_queue_id = 100)
│   200  │ SEND  │ 2           │ 2026-01-22 │
│   300  │ STOP  │ 2           │ 2026-01-24 │  ← current_state pega este (mais recente)
└────────┴───────┴─────────────┴────────────┘

CTE current_state retorna: queue_id = 300
CTE leads_with_response busca: WHERE followup_queue_id = 300
Resposta está em: followup_queue_id = 100
Resultado: João NÃO é encontrado como "com resposta" ❌
```

### Consequência

- A CTE `leads_with_response` retorna vazio ou quase vazio
- Todos os leads em `STOP + step<>0` são classificados como `NOT IN leads_with_response`
- Taxa de Retorno = 0% ou muito baixa
- Taxa de Intervenção = 0% (porque todos vão para Retorno quando a lógica é invertida)

---

## Solução

Modificar a CTE `leads_with_response` para buscar respostas em **qualquer registro** do `session_id` do lead, não apenas no registro mais recente.

### Query Corrigida

```sql
leads_with_response AS (
  -- Identificar leads em STOP que têm pelo menos uma resposta em QUALQUER registro do session_id
  SELECT DISTINCT fq.session_id
  FROM followup_queue fq
  INNER JOIN followup_response fr ON fr.followup_queue_id = fq.id
  WHERE fq.cod_agent IN ($1, $2, ...)
    AND fq.session_id IN (SELECT session_id FROM current_state WHERE state = 'STOP')
    [AND date_filter]
)
```

---

## Arquivos a Modificar

### src/pages/agente/hooks/useFollowupData.ts

#### 1. Corrigir `useFollowupReturnRate` (linhas 653-659)

**Antes:**
```sql
leads_with_response AS (
  SELECT DISTINCT cs.session_id
  FROM current_state cs
  INNER JOIN followup_response fr ON fr.followup_queue_id = cs.queue_id
  WHERE cs.state = 'STOP'
)
```

**Depois:**
```sql
leads_with_response AS (
  -- Identificar session_ids que têm resposta em QUALQUER registro da fila (não só o mais recente)
  SELECT DISTINCT fq.session_id
  FROM followup_queue fq
  INNER JOIN followup_response fr ON fr.followup_queue_id = fq.id
  WHERE fq.cod_agent IN (${agentPlaceholders})
    AND fq.session_id IN (SELECT session_id FROM current_state WHERE state = 'STOP')
    ${dateFilter}
)
```

#### 2. Corrigir `useFollowupPreviousPeriodStats` (mesma lógica, linhas 837-842)

Aplicar a mesma correção na query do período anterior.

---

## Regras das Métricas (Resumo)

| Métrica | Regra |
|---------|-------|
| **Taxa em FollowUp** | Lead com estado atual `SEND` |
| **Taxa de Retorno** | Lead com estado atual `STOP` + `step_number <> 0` + TEM resposta em qualquer registro do session_id |
| **Taxa de Intervenção** | Lead com estado atual `STOP` + `step_number <> 0` + NÃO tem resposta em nenhum registro do session_id |
| **Taxa de Perda** | Lead com estado atual `STOP` + `step_number = 0` |

**Garantia:** A soma das 4 taxas = 100%

---

## Seção Técnica

### Query SQL Completa Corrigida

```sql
WITH current_state AS (
  -- Pega o estado MAIS RECENTE de cada lead
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
  -- CORREÇÃO: buscar resposta em QUALQUER registro do session_id, não só o mais recente
  SELECT DISTINCT fq.session_id
  FROM followup_queue fq
  INNER JOIN followup_response fr ON fr.followup_queue_id = fq.id
  WHERE fq.cod_agent IN ($1, $2, ...)
    AND fq.session_id IN (SELECT session_id FROM current_state WHERE state = 'STOP')
    AND (fq.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $from
    AND (fq.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $to
)
SELECT 
  COUNT(*)::text as total_leads,
  COUNT(*) FILTER (WHERE state = 'SEND')::text as in_followup,
  COUNT(*) FILTER (
    WHERE state = 'STOP' 
      AND step_number <> 0 
      AND session_id IN (SELECT session_id FROM leads_with_response)
  )::text as returned,
  COUNT(*) FILTER (
    WHERE state = 'STOP' 
      AND step_number <> 0 
      AND session_id NOT IN (SELECT session_id FROM leads_with_response)
  )::text as intervention,
  COUNT(*) FILTER (WHERE state = 'STOP' AND step_number = 0)::text as lost,
  (SELECT COUNT(*)::text FROM followup_response fr
   JOIN followup_queue fq ON fq.id = fr.followup_queue_id
   WHERE fq.cod_agent IN ($1, $2, ...)
     AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $from
     AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $to
  ) as total_responses
FROM current_state;
```

### Ordem de Implementação

1. Modificar CTE `leads_with_response` em `useFollowupReturnRate`
2. Modificar CTE `leads_with_response` em `useFollowupPreviousPeriodStats`

### Validação

Após correção, verificar que:
- Taxa em FollowUp + Taxa de Retorno + Taxa de Intervenção + Taxa de Perda = 100%
- Leads em STOP com step>0 são divididos corretamente entre Retorno e Intervenção
- Taxa de Intervenção mostra valor > 0% quando há leads parados manualmente sem resposta

