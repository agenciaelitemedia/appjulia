
# Plano: Ajustar Cálculo de Conversões no Dashboard

## Problema Atual

A métrica "Conversões" no Dashboard está contando apenas os leads no estágio **"Contrato Assinado"**:

```sql
WHERE s.name = 'Contrato Assinado'
```

## Correção Necessária

Alterar para contar leads que estão em **"Contrato em Curso"** OU **"Contrato Assinado"**:

```sql
WHERE s.name IN ('Contrato em Curso', 'Contrato Assinado')
```

---

## Mudanças Necessárias

### Arquivo: `src/pages/dashboard/hooks/useDashboardData.ts`

#### 1. Atualizar `useDashboardStats` (linhas 154-165)

**De:**
```sql
SELECT COUNT(*) as count 
FROM crm_atendimento_cards c 
JOIN crm_atendimento_stages s ON c.stage_id = s.id 
WHERE s.name = 'Contrato Assinado' 
  AND c.cod_agent = ANY($1::varchar[])
  AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
  AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
```

**Para:**
```sql
SELECT COUNT(*) as count 
FROM crm_atendimento_cards c 
JOIN crm_atendimento_stages s ON c.stage_id = s.id 
WHERE s.name IN ('Contrato em Curso', 'Contrato Assinado')
  AND c.cod_agent = ANY($1::varchar[])
  AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
  AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
```

#### 2. Atualizar `useDashboardStatsPrevious` (linhas 218-227)

Mesma alteração para o período anterior de comparação:

**De:**
```sql
WHERE s.name = 'Contrato Assinado'
```

**Para:**
```sql
WHERE s.name IN ('Contrato em Curso', 'Contrato Assinado')
```

---

## Impacto

| KPI | Antes | Depois |
|-----|-------|--------|
| Conversões | Apenas "Contrato Assinado" | "Contrato em Curso" + "Contrato Assinado" |
| Taxa de Conversão | Baseada só em assinados | Baseada em gerados + assinados |

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/dashboard/hooks/useDashboardData.ts` | Alterar query em `useDashboardStats` e `useDashboardStatsPrevious` |
