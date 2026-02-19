

## Alinhar funis do Dashboard para usar estado atual (stage_id)

### Problema atual

Os funis (Julia e Campanhas) contam leads com base no **historico de movimentacao** (`crm_atendimento_history`), enquanto os cards MQL/SQL usam o **estado atual** (`crm_atendimento_cards.stage_id`). Isso causa discrepancia nos numeros.

### Solucao

Alterar as queries dos dois funis para usar `stage_id` atual com contagem **cumulativa por posicao** (leads na posicao >= X), em vez de buscar no historico.

### Arquivo: `src/pages/dashboard/hooks/useDashboardFunnels.ts`

#### Funil Julia (`useDashboardJuliaFunnel`)

Manter o CTE `julia_leads` (fonte dos leads Julia via `vw_painelv2_desempenho_julia`), mas trocar as CTEs de cada etapa para consultar o `stage_id` atual com contagem cumulativa:

```sql
WITH julia_leads AS (
  SELECT DISTINCT whatsapp::text as whatsapp, cod_agent::text as cod_agent
  FROM vw_painelv2_desempenho_julia
  WHERE cod_agent::text = ANY($1::varchar[])
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
),
atendimentos AS (
  SELECT COUNT(DISTINCT whatsapp)::int as count FROM julia_leads
),
-- Agora usa stage_id atual com position cumulativa
em_qualificacao AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM julia_leads jl
  JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
  JOIN crm_atendimento_stages s ON s.id = c.stage_id
  WHERE s.position >= (
    SELECT MIN(position) FROM crm_atendimento_stages
    WHERE LOWER(name) LIKE '%analise%caso%' OR LOWER(name) LIKE '%análise%caso%'
  )
),
qualificados AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM julia_leads jl
  JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
  JOIN crm_atendimento_stages s ON s.id = c.stage_id
  WHERE s.position >= (
    SELECT MIN(position) FROM crm_atendimento_stages WHERE name = 'Negociação'
  )
),
contratos_gerados AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM julia_leads jl
  JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
  JOIN crm_atendimento_stages s ON s.id = c.stage_id
  WHERE s.position >= (
    SELECT MIN(position) FROM crm_atendimento_stages WHERE name = 'Contrato em Curso'
  )
),
contratos_assinados AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM julia_leads jl
  JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
  JOIN crm_atendimento_stages s ON s.id = c.stage_id
  WHERE s.name = 'Contrato Assinado'
)
```

Mudancas-chave:
- Troca `h.to_stage_id` (historico) por `c.stage_id` (estado atual)
- Remove JOINs com `crm_atendimento_history`
- Usa `s.position >=` para contagem cumulativa (cada etapa inclui as posteriores)

#### Funil Campanhas (`useDashboardCampaignFunnel`)

Mesma logica aplicada: manter CTE `campaign_leads` e trocar as CTEs de etapa para usar `c.stage_id` com contagem cumulativa, removendo os JOINs com `crm_atendimento_history`.

### Resultado esperado

Os numeros dos funis passarao a ser consistentes com os cards MQL e SQL do dashboard, pois todos usarao o estado atual do lead no CRM.
