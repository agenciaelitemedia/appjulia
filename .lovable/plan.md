

## 3 Funis no Dashboard: Total Julia, Campanhas e Orgânicos

### Visão geral

Adicionar 3 funis visuais no estilo do "Funil de Conversão de Campanhas" (barras horizontais com gradiente, tooltips, taxas de conversão entre etapas) logo após os cards de métricas no Dashboard principal.

Os 3 funis serão exibidos lado a lado em um grid de 3 colunas (empilhados em mobile).

### Etapas de cada funil (5 etapas)

| Posição | Nome | Cor | Fonte de dados |
|---------|------|-----|----------------|
| 0 | Atendimentos | #3b82f6 | `vw_desempenho_julia` (COUNT DISTINCT whatsapp) |
| 1 | Em Qualificação | #22c55e | Cards que passaram por "Análise de Caso" |
| 2 | Qualificados | #eab308 | Cards em "Negociação" |
| 3 | Contratos Gerados | #f97316 | Cards em "Contrato em Curso" |
| 4 | Contratos Assinados | #8b5cf6 | Cards em "Contrato Assinado" |

### Estratégia de dados

**Funil 1 - Total Julia**: Buscar todos os whatsapp DISTINTOS atendidos pela Julia (`vw_desempenho_julia`) no período/agentes filtrados, depois cruzar com `crm_atendimento_cards` para verificar em qual estágio cada lead está.

**Funil 2 - Campanhas**: Buscar todos os whatsapp DISTINTOS da tabela `campaing_ads` no período, cruzar com `log_first_messages` para atendidos, depois com `crm_atendimento_cards` para os estágios (mesma lógica já existente no `useCampanhasFunnel`).

**Funil 3 - Orgânicos**: Para cada etapa, calcular: `Total Julia - Campanhas`. Isso será feito no frontend subtraindo os valores do Funil 2 dos valores do Funil 1.

### Arquivos e alterações

#### 1. Novo hook: `src/pages/dashboard/hooks/useDashboardFunnels.ts`

Criar 2 queries:

- **`useDashboardJuliaFunnel`**: Query com CTEs:
  - `julia_leads`: SELECT DISTINCT whatsapp, cod_agent FROM `vw_desempenho_julia` filtrado por período e agentes
  - Cruzar com `crm_atendimento_cards` + `crm_atendimento_history` para contar cada estágio
  - Retornar array de 5 etapas com count, percentage e conversionRate

- **`useDashboardCampaignFunnel`**: Reutilizar a mesma lógica da query `useCampanhasFunnel` já existente mas adaptada para receber `UnifiedFiltersState` (em vez de `CampanhasFiltersState`)

O funil orgânico será calculado no componente: `orgânico[i] = julia[i] - campanha[i]`

#### 2. Novo componente: `src/pages/dashboard/components/DashboardTripleFunnel.tsx`

- Receber dados dos 3 funis e estado de loading
- Renderizar um grid `grid-cols-1 lg:grid-cols-3 gap-4`
- Cada funil será um Card com o estilo visual do `CampanhasFunnelChart` (barras horizontais com gradiente, tooltips, setas de conversão entre etapas)
- Títulos: "Funil Total Julia", "Funil Campanhas", "Funil Orgânicos"
- Ícones distintos para cada funil (Bot, Megaphone, Leaf)

#### 3. Editar: `src/pages/Dashboard.tsx`

- Importar o novo hook e componente
- Chamar `useDashboardJuliaFunnel(filters)` e `useDashboardCampaignFunnel(filters)`
- Inserir o `DashboardTripleFunnel` logo após os stat cards (antes do gráfico de evolução)
- Adicionar invalidação dos novos queries no `handleRefresh`

### Detalhes técnicos da query Julia Funnel

```sql
WITH julia_leads AS (
  SELECT DISTINCT whatsapp::text as whatsapp, cod_agent::text as cod_agent
  FROM vw_desempenho_julia
  WHERE cod_agent::text = ANY($1::varchar[])
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
),
-- Etapa 0: Atendimentos (total de leads atendidos pela Julia)
atendimentos AS (
  SELECT COUNT(DISTINCT whatsapp)::int as count FROM julia_leads
),
-- Etapa 1: Em Qualificação (passaram por Análise de Caso)
em_qualificacao AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM julia_leads jl
  JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
  JOIN crm_atendimento_history h ON h.card_id = c.id
  JOIN crm_atendimento_stages s ON s.id = h.to_stage_id
  WHERE LOWER(s.name) LIKE '%analise%caso%' OR LOWER(s.name) LIKE '%análise%caso%'
),
-- Etapa 2: Qualificados (Negociação)
qualificados AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM julia_leads jl
  JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
  WHERE c.stage_id IN (SELECT id FROM crm_atendimento_stages WHERE name = 'Negociação')
),
-- Etapa 3: Contratos Gerados (Contrato em Curso)
contratos_gerados AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM julia_leads jl
  JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
  WHERE c.stage_id IN (SELECT id FROM crm_atendimento_stages WHERE name = 'Contrato em Curso')
),
-- Etapa 4: Contratos Assinados
contratos_assinados AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM julia_leads jl
  JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
  WHERE c.stage_id IN (SELECT id FROM crm_atendimento_stages WHERE name = 'Contrato Assinado')
)
SELECT 'Atendimentos' as stage_name, '#3b82f6' as stage_color, 0 as position, (SELECT count FROM atendimentos) as count
UNION ALL SELECT 'Em Qualificação', '#22c55e', 1, (SELECT count FROM em_qualificacao)
UNION ALL SELECT 'Qualificados', '#eab308', 2, (SELECT count FROM qualificados)
UNION ALL SELECT 'Contratos Gerados', '#f97316', 3, (SELECT count FROM contratos_gerados)
UNION ALL SELECT 'Contratos Assinados', '#8b5cf6', 4, (SELECT count FROM contratos_assinados)
ORDER BY position
```

A query do funil de campanhas será a mesma já existente em `useCampanhasFunnel`, adaptada para o formato de filtros do dashboard, com as etapas renomeadas para manter consistência (Entrada -> Atendimentos, Atendidos por JulIA -> Em Qualificação, etc.).

