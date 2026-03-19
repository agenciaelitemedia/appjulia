

# Unificar métrica de Atendimentos: Card e Funil Julia

## Problema
O card "Atendimentos" conta sessões únicas (`COUNT(DISTINCT session_id)`) da view `vw_painelv2_desempenho_julia`, enquanto o funil Julia conta leads únicos no CRM que têm match com a Julia. Isso gera números diferentes.

## Solução
Alterar o primeiro estágio ("Atendimentos") do funil Julia em `useDashboardFunnels.ts` para usar a mesma query do card: `COUNT(DISTINCT session_id)` da `vw_painelv2_desempenho_julia`, filtrado por `cod_agent` e `created_at`.

## Alteração

### Arquivo: `src/pages/dashboard/hooks/useDashboardFunnels.ts`

Na função `useDashboardJuliaFunnel`, substituir o CTE `atendimentos` que hoje conta leads do CRM com match Julia:

```sql
-- ANTES (conta leads CRM com match Julia)
atendimentos AS (
  SELECT COUNT(*)::int as count FROM julia_leads
)

-- DEPOIS (conta sessões Julia, igual ao card)
atendimentos AS (
  SELECT COUNT(DISTINCT v.session_id)::int as count
  FROM vw_painelv2_desempenho_julia v
  WHERE v.cod_agent::text = ANY($1::varchar[])
    AND (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
    AND (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
)
```

Os demais estágios do funil (Em Qualificação, Qualificados, Contratos Gerados, Contratos Assinados) permanecem inalterados, pois dependem corretamente dos leads no CRM.

## Resultado
O número exibido no topo do funil Julia será idêntico ao do card "Atendimentos", ambos representando sessões únicas da Julia no período.

