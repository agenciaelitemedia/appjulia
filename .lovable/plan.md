

# Substituir "Média Humano" por "Taxa de Retorno" do FollowUp

## Definição de "Retorno"

Conforme já implementado na página de FollowUp (`useFollowupData.ts` linhas 730-736):
- **Retornado** = lead com `state = 'STOP'` + `step_number <> 0` + possui registro na tabela `followup_response`
- **Taxa de Retorno** = `retornados / total_leads_no_followup × 100`

Ou seja, é o lead que **respondeu** durante o processo de followup (não foi parado manualmente nem perdido).

## Alterações

### 1. Novo hook: `src/pages/crm/hooks/useFollowupReturnRate.ts`

Criar um hook que executa a mesma lógica de taxa de retorno do followup, filtrando por `agentCodes`, `dateFrom` e `dateTo`. A query usará:

```sql
WITH current_state AS (
  SELECT DISTINCT ON (cod_agent, session_id)
    session_id, id as queue_id, state, step_number
  FROM followup_queue
  WHERE cod_agent IN (...) AND send_date filtrado por período
  ORDER BY cod_agent, session_id, send_date DESC
),
leads_with_response AS (
  SELECT DISTINCT fq.session_id
  FROM followup_queue fq
  INNER JOIN followup_response fr ON fr.followup_queue_id = fq.id
  WHERE fq.session_id IN (SELECT session_id FROM current_state WHERE state = 'STOP')
)
SELECT 
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE state='STOP' AND step_number<>0 
    AND session_id IN (SELECT session_id FROM leads_with_response)) as returned
FROM current_state
```

Retorna: `{ totalLeads, returned, returnRate }`.

### 2. `src/pages/crm/CRMPage.tsx`

- Importar e chamar o novo hook
- Passar os dados como prop para `CRMDashboardSummary`

### 3. `src/pages/crm/components/CRMDashboardSummary.tsx`

- Substituir o card "Média Humano" (posição 3) pelo card "Taxa de Retorno"
- Exibir: valor `XX.X%`, subtexto `X de Y responderam`
- Ícone: `MessageCircleReply` ou similar
- Borda: `border-l-chart-1`
- Remover cálculos de `humanAvgDays`, `resolvedCount`, `activeCount` do useMemo

