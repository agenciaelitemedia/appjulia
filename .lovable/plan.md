

# Alinhar total da Taxa de Retorno com os cards do CRM

## Problema
O card "Taxa de Retorno" consulta a tabela `followup_queue` filtrada por `send_date`, encontrando 34 WhatsApps únicos. Já o card "Atendimentos" consulta `crm_atendimento_cards` filtrada por `stage_entered_at`, encontrando 32. São tabelas e colunas de data diferentes, gerando a divergência.

## Solução

### `src/pages/crm/hooks/useFollowupReturnRate.ts`

Restringir a query para considerar apenas WhatsApps que existem nos cards do CRM no mesmo período. Adicionar um filtro `AND session_id IN (SELECT whatsapp_number FROM crm_atendimento_cards WHERE ...)`:

```sql
WITH crm_leads AS (
  SELECT DISTINCT whatsapp_number
  FROM crm_atendimento_cards
  WHERE cod_agent = ANY($1::varchar[])
    AND (stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
    AND (stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
),
current_state AS (
  SELECT DISTINCT ON (session_id)
    session_id, id as queue_id, state, step_number
  FROM followup_queue
  WHERE cod_agent::text = ANY($1::varchar[])
    AND session_id IN (SELECT whatsapp_number FROM crm_leads)
  ORDER BY session_id, send_date DESC
),
leads_with_response AS (
  SELECT DISTINCT fq.session_id
  FROM followup_queue fq
  INNER JOIN followup_response fr ON fr.followup_queue_id = fq.id
  WHERE fq.cod_agent::text = ANY($1::varchar[])
    AND fq.session_id IN (SELECT session_id FROM current_state WHERE state = 'STOP')
)
SELECT 
  COUNT(*)::text as total_leads,
  COUNT(*) FILTER (
    WHERE state = 'STOP' AND step_number <> 0 
    AND session_id IN (SELECT session_id FROM leads_with_response)
  )::text as returned
FROM current_state
```

Isso garante que o universo de leads da taxa de retorno seja exatamente o mesmo dos cards do CRM (filtrados por `stage_entered_at`), eliminando a divergência 34 vs 32.

