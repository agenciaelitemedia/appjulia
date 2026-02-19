

## Alinhar funis para usar `stage_entered_at` do CRM

### Problema atual

Os funis filtram leads pela data de criacao da sessao Julia (`created_at` da view) ou da campanha (`ca.created_at`), e depois verificam o stage atual. Isso causa divergencia com os cards MQL/SQL que filtram por `stage_entered_at` do `crm_atendimento_cards`.

### Solucao

Inverter a logica: partir do `crm_atendimento_cards` filtrado por `stage_entered_at` no periodo, e depois verificar a origem (Julia ou Campanha) via JOIN.

### Arquivo: `src/pages/dashboard/hooks/useDashboardFunnels.ts`

#### Funil Julia (`useDashboardJuliaFunnel`)

Nova logica:

```sql
WITH crm_leads AS (
  SELECT c.id, c.cod_agent, c.whatsapp_number, c.stage_id
  FROM crm_atendimento_cards c
  WHERE c.cod_agent = ANY($1::varchar[])
    AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
    AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
),
julia_leads AS (
  SELECT DISTINCT cl.id, cl.stage_id
  FROM crm_leads cl
  WHERE EXISTS (
    SELECT 1 FROM vw_painelv2_desempenho_julia v
    WHERE v.cod_agent::text = cl.cod_agent
      AND v.whatsapp::text = cl.whatsapp_number
  )
),
atendimentos AS (
  SELECT COUNT(*)::int as count FROM julia_leads
),
em_qualificacao AS (
  SELECT COUNT(*)::int as count FROM julia_leads jl
  JOIN crm_atendimento_stages s ON s.id = jl.stage_id
  WHERE s.name IN ('Negociação','Contrato em Curso','Contrato Assinado')
     OR LOWER(s.name) LIKE '%analise%caso%'
     OR LOWER(s.name) LIKE '%análise%caso%'
),
-- qualificados, contratos_gerados, contratos_assinados: mesma estrutura
```

Mudancas-chave:
- Filtro de data passa a ser `c.stage_entered_at` (igual aos cards)
- A verificacao de origem Julia e feita via EXISTS na view, sem filtro de data na view
- Contagem direta sem DISTINCT desnecessario (ja filtrado no CTE)

#### Funil Campanhas (`useDashboardCampaignFunnel`)

Mesma inversao: partir do CRM com `stage_entered_at`, depois verificar origem via EXISTS em `campaing_ads`.

```sql
WITH crm_leads AS (
  SELECT c.id, c.cod_agent, c.whatsapp_number, c.stage_id
  FROM crm_atendimento_cards c
  WHERE c.cod_agent = ANY($1::varchar[])
    AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
    AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
),
campaign_leads AS (
  SELECT DISTINCT cl.id, cl.stage_id
  FROM crm_leads cl
  WHERE EXISTS (
    SELECT 1 FROM campaing_ads ca
    LEFT JOIN sessions s ON s.id = ca.session_id::int
    WHERE ca.cod_agent::text = cl.cod_agent
      AND COALESCE(NULLIF((ca.campaign_data::jsonb)->>'phone',''), s.whatsapp_number::text) = cl.whatsapp_number
  )
)
-- mesmas CTEs de etapas
```

### Resultado esperado

Os numeros dos funis passarao a coincidir com os cards MQL e SQL, pois todos usam `stage_entered_at` como base temporal.

