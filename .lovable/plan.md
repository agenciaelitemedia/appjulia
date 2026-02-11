

## Alterar Performance por Agente para contar apenas sessões da Julia

Arquivo: `src/pages/crm/hooks/useCRMStatistics.ts` (função `useCRMAgentPerformance`)

### Problema atual

A query conta todos os cards do `crm_atendimento_cards` como "Atendimentos". O usuário quer que:
- **Atendimentos** = apenas sessões atendidas pela Julia (via `vw_desempenho_julia`)
- **Qualificados** e **Contratos** = calculados apenas sobre os leads que a Julia atendeu

### Nova lógica da query

1. Buscar sessões distintas da Julia por `cod_agent` e `whatsapp` no período (`vw_desempenho_julia`)
2. Fazer JOIN com `crm_atendimento_cards` pelo `whatsapp_number` e `cod_agent` para verificar em qual estágio está cada lead atendido pela Julia
3. Calcular:
   - **total_leads** (Atendimentos) = COUNT DISTINCT de whatsapp atendidos pela Julia
   - **qualified_leads** = desses, quantos estão em Negociação / Contrato em Curso / Contrato Assinado
   - **qualified_rate** = qualified_leads / total_leads * 100
   - **contract_leads** = desses, quantos estão em Contrato em Curso / Contrato Assinado
   - **contract_rate** = contract_leads / total_leads * 100
   - **avg_time_days** = tempo médio dos cards atendidos pela Julia

### Query proposta

```sql
WITH julia_sessions AS (
  SELECT DISTINCT cod_agent::text as cod_agent, whatsapp::text as whatsapp
  FROM vw_desempenho_julia
  WHERE cod_agent::text = ANY($1::varchar[])
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
),
qualified_stages AS (
  SELECT id FROM crm_atendimento_stages 
  WHERE name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
),
contract_stages AS (
  SELECT id FROM crm_atendimento_stages 
  WHERE name IN ('Contrato em Curso', 'Contrato Assinado')
)
SELECT 
  j.cod_agent,
  COALESCE(a.owner_name, j.cod_agent) as owner_name,
  COUNT(DISTINCT j.whatsapp)::int as total_leads,
  COUNT(DISTINCT CASE WHEN c.stage_id IN (SELECT id FROM qualified_stages) THEN j.whatsapp END)::int as qualified_leads,
  -- qualified_rate, contract_leads, contract_rate, avg_time_days calculados sobre esses leads
FROM julia_sessions j
LEFT JOIN crm_atendimento_cards c ON c.whatsapp_number = j.whatsapp AND c.cod_agent = j.cod_agent
LEFT JOIN "vw_list_client-agents-users" a ON j.cod_agent = a.cod_agent::text
GROUP BY j.cod_agent, a.owner_name
ORDER BY total_leads DESC
```

### Arquivo alterado

Apenas `src/pages/crm/hooks/useCRMStatistics.ts` -- a query da função `useCRMAgentPerformance` (linhas 88-148). Tipos e componente da tabela permanecem iguais pois os campos retornados são os mesmos.

