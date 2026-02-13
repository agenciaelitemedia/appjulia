

## Correcao dos Funis do Dashboard - Dados Inflados

### Causa raiz identificada

Os funis estao mostrando numeros maiores que o real porque a query so filtra por data na tabela `vw_desempenho_julia` (para obter os whatsapps), mas quando faz o JOIN com `crm_atendimento_cards` para contar os estagios, **nao aplica nenhum filtro de data nos cards**. Isso faz com que cards de periodos anteriores sejam contados.

Comparacao:
- **Card de metricas** (correto): filtra `crm_atendimento_cards` por `stage_entered_at` dentro do periodo
- **Funil** (errado): pega whatsapps do periodo, depois conta TODOS os cards desse whatsapp, sem filtro de data no card

### Solucao

Adicionar filtro de `stage_entered_at` nos CTEs dos funis (em_qualificacao, qualificados, contratos_gerados, contratos_assinados) para ambos os funis (Julia e Campanhas), alinhando com a logica do card de metricas.

### Arquivo: `src/pages/dashboard/hooks/useDashboardFunnels.ts`

**Funil Julia** - Adicionar filtro de data em cada CTE que faz JOIN com `crm_atendimento_cards`:

```sql
-- ANTES (sem filtro de data no card):
em_qualificacao AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM julia_leads jl
  JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
  JOIN crm_atendimento_stages s ON s.id = c.stage_id
  WHERE s.position >= (SELECT MIN(position) FROM crm_atendimento_stages WHERE ...)
)

-- DEPOIS (com filtro de data no card):
em_qualificacao AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM julia_leads jl
  JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
  JOIN crm_atendimento_stages s ON s.id = c.stage_id
  WHERE s.position >= (SELECT MIN(position) FROM crm_atendimento_stages WHERE ...)
    AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
    AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
)
```

Aplicar em todos os 4 CTEs de estagio:
1. `em_qualificacao`
2. `qualificados`
3. `contratos_gerados`
4. `contratos_assinados`

**Funil Campanhas** - Mesma correcao nos 4 CTEs equivalentes.

### Resultado esperado

Os numeros dos funis vao corresponder aos cards de metricas do Dashboard, que ja usam `stage_entered_at` como filtro temporal.

