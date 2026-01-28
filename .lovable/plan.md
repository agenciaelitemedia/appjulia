
# Plano: Padronizar Cálculo de Conversão em Todo o Sistema

## Resumo

Corrigir a definição de "conversão" no hook `useCRMAgentPerformance` para incluir **tanto** "Contrato em Curso" **quanto** "Contrato Assinado", alinhando com o restante do sistema.

---

## Problema Identificado

Na página de **Estatísticas do CRM** (`/crm/lead-estatisticas`), a tabela de **Performance por Agente** calcula a taxa de conversão considerando apenas contratos assinados. Isso está inconsistente com as outras partes do sistema.

### Locais já corretos:
- Dashboard principal: ✅ Usa ambos estágios
- CRM Dashboard Summary: ✅ Usa ambos estágios  
- CRM Summary Stats: ✅ Usa ambos estágios

### Local a corrigir:
- `useCRMAgentPerformance`: ❌ Usa apenas "Contrato Assinado"

---

## Mudanças Necessárias

### Arquivo: `src/pages/crm/hooks/useCRMStatistics.ts`

**Antes** (linhas 99-111):
```sql
WITH conversion_stage AS (
  SELECT id FROM crm_atendimento_stages WHERE name = 'Contrato Assinado' LIMIT 1
)
SELECT 
  c.cod_agent,
  COALESCE(a.owner_name, c.cod_agent) as owner_name,
  COUNT(c.id)::int as total_leads,
  COUNT(CASE WHEN c.stage_id = (SELECT id FROM conversion_stage) THEN 1 END)::int as converted_leads,
  ...
```

**Depois**:
```sql
WITH conversion_stages AS (
  SELECT id FROM crm_atendimento_stages 
  WHERE name IN ('Contrato em Curso', 'Contrato Assinado')
)
SELECT 
  c.cod_agent,
  COALESCE(a.owner_name, c.cod_agent) as owner_name,
  COUNT(c.id)::int as total_leads,
  COUNT(CASE WHEN c.stage_id IN (SELECT id FROM conversion_stages) THEN 1 END)::int as converted_leads,
  ...
```

---

## Impacto

### Na Tabela de Performance por Agente:

| Coluna | Antes | Depois |
|--------|-------|--------|
| Leads Convertidos | Apenas assinados | Gerados + Assinados |
| Taxa de Conversão | Assinados / Total | (Gerados + Assinados) / Total |

---

## Resumo dos Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/crm/hooks/useCRMStatistics.ts` | Modificar query SQL para incluir ambos estágios |
