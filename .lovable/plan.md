
## Plano de Implementação: Alinhar Funis com stage_entered_at

### Diagnóstico

O problema está em **duas linhas de lógica diferente**:

1. **Card de Métricas (`useDashboardStats`)** - linha 167:
   - Filtra por `c.stage_entered_at >= dateFrom AND <= dateTo`
   - Conta APENAS contratos que **entraram** naquele estágio no período selecionado
   - Resultado: 7 contratos gerados ontem

2. **Funis (`useDashboardFunnels.ts`)** - não tem filtro de data na transição:
   - Conta cards com `stage_id` atual >= posição do estágio alvo
   - NÃO filtra por quando o card entrou no estágio
   - Conta cards que estavam em contrato de ANTES do período
   - Resultado: 4 contratos gerados (liderança de antes dos períodos somados)

### Solução

Adicionar **dois filtros de data** em cada CTE de estágio no funil:
1. Manter filtro na `julia_leads` (data de atendimento na Julia)
2. **Novo filtro**: `stage_entered_at` para contar apenas transitions dentro do período

### Implementação

#### **Arquivo: `src/pages/dashboard/hooks/useDashboardFunnels.ts`**

**Mudança no padrão de CTE de estágio:**

```sql
-- ANTES (conta cards que ESTÃO em contrato, sem filtrar quando entraram):
contratos_gerados AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM julia_leads jl
  JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
  JOIN crm_atendimento_stages s ON s.id = c.stage_id
  WHERE s.position >= (SELECT MIN(position) FROM crm_atendimento_stages WHERE name = 'Contrato em Curso')
)

-- DEPOIS (conta cards que ENTRARAM em contrato no período):
contratos_gerados AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM julia_leads jl
  JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
  JOIN crm_atendimento_stages s ON s.id = c.stage_id
  WHERE s.position >= (SELECT MIN(position) FROM crm_atendimento_stages WHERE name = 'Contrato em Curso')
    AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
    AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
)
```

**CTEs afetados em `useDashboardJuliaFunnel`:**
- `em_qualificacao` (linhas 58-67)
- `qualificados` (linhas 68-76)
- `contratos_gerados` (linhas 77-85)
- `contratos_assinados` (linhas 86-94)

**CTEs afetados em `useDashboardCampaignFunnel`:**
- `em_qualificacao` (linhas 141-150)
- `qualificados` (linhas 151-159)
- `contratos_gerados` (linhas 160-168)
- `contratos_assinados` (linhas 169-177)

**CTEs afetados em `useDashboardOrganicFunnel`:**
- `em_qualificacao` (linhas 233-242)
- `qualificados` (linhas 243-251)
- `contratos_gerados` (linhas 252-260)
- `contratos_assinados` (linhas 261-269)

### Resultado Esperado

- ✅ Funil Julia - Contratos Gerados: 7 (alinhado com card de métricas)
- ✅ Funil Campanhas: valores alinhados com transições do período
- ✅ Funil Orgânicos: valores válidos e consistentes
- ✅ Todas as três visualizações refletem transições **no período selecionado**, não apenas estado atual

