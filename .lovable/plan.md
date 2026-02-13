

## Correcao da Discrepancia nos Funis do Dashboard (8 vs 7)

### Causa raiz

Os funis em `useDashboardFunnels.ts` usam `crm_atendimento_history` para contar leads que **ja passaram** por cada estagio. Isso inclui cards que foram movidos para 'Contrato em Curso' mas depois voltaram para outro estagio (ex: desqualificado). Por isso o funil mostra 8 enquanto o card e a pagina de contratos mostram 7.

O card de metricas (`useDashboardStats`) conta apenas cards que estao **atualmente** naquele estagio, e a pagina de Contratos Julia usa a view `vw_desempenho_julia_contratos` que tambem reflete o estado atual.

### Solucao

Alterar os CTEs dos funis (Julia e Campanhas) para contar apenas cards que estao **atualmente** no estagio, em vez de cards que ja passaram por ele via historico. Isso alinha o funil com o card de metricas e com a pagina de contratos.

### Arquivo: `src/pages/dashboard/hooks/useDashboardFunnels.ts`

**Funil Julia** (linhas 58-89) — Substituir os CTEs que usam `crm_atendimento_history` por consultas que verificam o `stage_id` atual do card:

```sql
-- ANTES (conta qualquer card que JA PASSOU pelo estagio):
em_qualificacao AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM julia_leads jl
  JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
  JOIN crm_atendimento_history h ON h.card_id = c.id
  JOIN crm_atendimento_stages s ON s.id = h.to_stage_id
  WHERE LOWER(s.name) LIKE '%analise%caso%'
)

-- DEPOIS (conta cards ATUALMENTE no estagio ou que ja passaram alem dele):
em_qualificacao AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM julia_leads jl
  JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
  JOIN crm_atendimento_stages s ON s.id = c.stage_id
  WHERE s.position >= (SELECT MIN(position) FROM crm_atendimento_stages WHERE LOWER(name) LIKE '%analise%caso%' OR LOWER(name) LIKE '%análise%caso%')
)
```

Aplicar a mesma logica para os 4 CTEs de estagio (em_qualificacao, qualificados, contratos_gerados, contratos_assinados) em ambos os funis:

1. **em_qualificacao**: cards cujo estagio atual tem `position >=` posicao de 'Analise de Caso'
2. **qualificados**: cards cujo estagio atual tem `position >=` posicao de 'Negociacao'
3. **contratos_gerados**: cards cujo estagio atual tem `position >=` posicao de 'Contrato em Curso'
4. **contratos_assinados**: cards cujo estagio atual tem `position >=` posicao de 'Contrato Assinado'

Essa abordagem faz o funil ser cumulativo (quem chegou a 'Contrato Assinado' tambem conta em 'Contratos Gerados', 'Qualificados', etc.), o que e o comportamento correto de um funil de conversao.

**Funil Campanhas** (linhas 136-176) — Mesma correcao, trocando os JOINs com `crm_atendimento_history` por verificacao do `c.stage_id` atual com posicao.

### Resultado esperado

- Funil Total Julia: Contratos Gerados = 7 (mesmo valor do card e da pagina de contratos)
- Funil Campanhas: valores alinhados com a mesma logica
- Funil Organicos: calculado corretamente como Julia - Campanhas

