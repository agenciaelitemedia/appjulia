

# Plano: Card de Taxa de Conversão Geral no Módulo Campanhas

## Objetivo

Adicionar um card de resumo que mostre a **Taxa de Conversão Geral** calculada como:

**Taxa = (Leads Qualificados de Campanhas / Total de Leads Captados) × 100**

Onde **Leads Qualificados** são aqueles que estão nos estágios:
- Negociação
- Contrato em Curso
- Contrato Assinado

---

## Modificações Necessárias

| Arquivo | Alteração |
|---------|-----------|
| `useCampanhasData.ts` | Criar hook `useCampanhasQualified` para buscar leads qualificados de campanhas |
| `useCampanhasData.ts` | Atualizar `useCampanhasSummary` para incluir taxa de conversão real |
| `CampanhasSummary.tsx` | Substituir card "Engajamento" por card de "Taxa de Conversão" com dados reais |
| `types.ts` | Adicionar campos `qualifiedLeads` e `previousQualifiedLeads` ao tipo `CampaignSummary` |

---

## Novo Hook: `useCampanhasQualified`

Query SQL que relaciona leads de campanhas com estágios qualificados do CRM:

```sql
WITH campaign_sessions AS (
  -- Relacionar campanhas com sessions via session_id
  SELECT DISTINCT 
    s.whatsapp_number::text,
    a.cod_agent::text
  FROM campaing_ads ca
  JOIN sessions s ON s.id = ca.session_id::int
  JOIN agents a ON a.id = s.agent_id
  WHERE ca.cod_agent::text = ANY($1::varchar[])
    AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
    AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
),
qualified_stages AS (
  -- IDs dos estágios qualificados
  SELECT id FROM crm_atendimento_stages 
  WHERE name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
)
SELECT COUNT(DISTINCT c.id)::int as qualified_count
FROM crm_atendimento_cards c
WHERE c.stage_id IN (SELECT id FROM qualified_stages)
  AND EXISTS (
    SELECT 1 FROM campaign_sessions cs 
    WHERE cs.whatsapp_number = c.whatsapp_number::text
      AND cs.cod_agent = c.cod_agent
  )
```

---

## Atualização do `CampaignSummary`

Adicionar campos ao tipo:

```typescript
export interface CampaignSummary {
  totalCampaigns: number;
  totalLeads: number;
  leadsPerCampaign: number;
  conversionRate: number;       // Agora calculado: (qualified / total) * 100
  qualifiedLeads: number;       // NOVO: Leads nos estágios qualificados
  topPlatform: string;
  topPlatformLeads: number;
  previousTotalCampaigns?: number;
  previousTotalLeads?: number;
  previousQualifiedLeads?: number; // NOVO: Para comparação
}
```

---

## Atualização do Card "Taxa de Conversão"

O card atual exibe `0.0%` porque `conversionRate` não estava sendo calculado. A atualização vai:

1. Buscar `qualifiedLeads` usando o novo hook
2. Calcular `conversionRate = (qualifiedLeads / totalLeads) * 100`
3. Adicionar tooltip explicativo
4. Exibir comparação com período anterior (quando disponível)

### Visual do Card

```text
┌─────────────────────────────┐
│ Taxa de Conversão           │
│ ▲ 12.5%                     │  ← Valor calculado
│ 15 qualificados             │  ← Subtítulo com total
│ +2.3% vs anterior           │  ← Variação (verde/vermelho)
└─────────────────────────────┘
```

---

## Implementação Detalhada

### 1. Atualizar `types.ts`

Adicionar `qualifiedLeads` e `previousQualifiedLeads` ao tipo `CampaignSummary`.

### 2. Criar `useCampanhasQualified` em `useCampanhasData.ts`

Hook que executa a query para contar leads qualificados vindos de campanhas.

### 3. Atualizar `useCampanhasSummary`

Integrar o hook de qualificados e calcular a taxa de conversão real:

```typescript
export function useCampanhasSummary(filters: CampanhasFiltersState) {
  const { data: rawData = [] } = useCampanhasRaw(filters);
  const { data: qualifiedData } = useCampanhasQualified(filters);
  const { data: previousQualified } = useCampanhasQualifiedPrevious(filters);
  
  const qualifiedLeads = qualifiedData?.qualified_count || 0;
  const conversionRate = rawData.length > 0 
    ? (qualifiedLeads / rawData.length) * 100 
    : 0;
  
  return {
    ...existingFields,
    qualifiedLeads,
    conversionRate,
    previousQualifiedLeads: previousQualified?.qualified_count || 0,
  };
}
```

### 4. Atualizar `CampanhasSummary.tsx`

Modificar o card de "Taxa de Conversão" para:
- Usar o valor real de `conversionRate`
- Exibir subtítulo com total de qualificados
- Adicionar variação comparativa

---

## Resultado Esperado

1. Card de "Taxa de Conversão" exibindo valor real baseado em leads qualificados
2. Tooltip explicando quais estágios são considerados "qualificados"
3. Comparação percentual com período anterior
4. Subtítulo mostrando quantidade absoluta de leads qualificados
5. Cores indicativas (verde = melhoria, vermelho = queda)

