

# Corrigir contagem de Atendimentos no funil de Campanhas

## Problema

O funil de Campanhas no dashboard conta "Atendimentos" a partir de `crm_atendimento_cards` filtrado por `stage_entered_at`, e depois cruza com `campaing_ads`. Isso exclui leads de campanha que ainda não entraram no CRM ou cuja `stage_entered_at` está fora do período. O número correto deveria vir direto da tabela `campaing_ads`, contando todos os leads de campanha no período.

## Solução

Alterar a query do `useDashboardCampaignFunnel` em `src/pages/dashboard/hooks/useDashboardFunnels.ts`:

### CTE `atendimentos` — contar direto de `campaing_ads`

```sql
-- ANTES: conta leads CRM que tem match com campanha
atendimentos AS (
  SELECT COUNT(*)::int as count FROM campaign_leads
)

-- DEPOIS: conta leads direto da tabela de campanhas (todas as entradas)
atendimentos AS (
  SELECT COUNT(*)::int as count
  FROM campaing_ads ca
  WHERE ca.cod_agent::text = ANY($1::varchar[])
    AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
    AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
)
```

Os CTEs de `crm_leads` e `campaign_leads` continuam sendo usados para os estágios seguintes (Em Qualificação, Qualificados, etc.), pois esses dependem do CRM. Apenas o topo do funil muda para refletir o total real de leads de campanha.

## Resultado

O "Atendimentos" do funil de Campanhas mostrará o total real de leads vindos de anúncios no período, não apenas os que já entraram no CRM.

