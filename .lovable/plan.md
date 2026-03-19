

# Corrigir consistência do funil Orgânicos

## Problema identificado

O funil "Orgânicos" é calculado como `Julia - Campanhas` para cada estágio. Para os estágios 1-4 isso funciona porque ambos contam leads CRM. Mas para "Atendimentos" (estágio 0):

- **Julia**: `COUNT(DISTINCT session_id)` da view de desempenho (sessões de IA)
- **Campanhas**: `COUNT(*)` da `campaing_ads` (entradas de anúncios)

A subtração mistura unidades diferentes, gerando um número inconsistente no funil Orgânicos.

## Opções de solução

### Opção A: Unificar "Atendimentos" de Campanhas para contar sessões Julia com match em campaign
Alterar o CTE `atendimentos` do funil de Campanhas para contar `COUNT(DISTINCT v.session_id)` da `vw_painelv2_desempenho_julia` onde o lead tem match na `campaing_ads`. Assim ambos os funis usam a mesma unidade (sessões Julia) e a subtração para Orgânicos faz sentido.

```sql
-- Campanhas: contar sessões Julia que vieram de campanha
atendimentos AS (
  SELECT COUNT(DISTINCT v.session_id)::int as count
  FROM vw_painelv2_desempenho_julia v
  WHERE v.cod_agent::text = ANY($1::varchar[])
    AND (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
    AND (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
    AND EXISTS (
      SELECT 1 FROM campaing_ads ca
      LEFT JOIN sessions s ON s.id = ca.session_id::int
      WHERE ca.cod_agent::text = v.cod_agent::text
        AND COALESCE(NULLIF((ca.campaign_data::jsonb)->>'phone', ''), s.whatsapp_number::text) = v.whatsapp::text
    )
)
```

**Vantagem**: Orgânicos = Sessões Julia sem campanha. Unidade consistente.
**Desvantagem**: Pode mostrar menos "Atendimentos de campanha" que o total real de leads de anúncios.

### Opção B: Manter como está e apenas renomear
Renomear o estágio 0 de cada funil para deixar claro que medem coisas diferentes:
- Julia: "Sessões Julia"
- Campanhas: "Leads de Anúncios"
- Orgânicos: não exibir o estágio 0 (ou calcular separadamente)

## Recomendação

**Opção A** -- unifica a unidade para "sessões Julia" em todos os funis, tornando a subtração para Orgânicos matematicamente correta. O número de Campanhas pode ser menor que o total de `campaing_ads`, mas representa com precisão quantas sessões Julia vieram de campanha.

## Alteração

### Arquivo: `src/pages/dashboard/hooks/useDashboardFunnels.ts`

Na função `useDashboardCampaignFunnel`, substituir o CTE `atendimentos` (linhas 139-145) pela versão que conta sessões Julia com match em `campaing_ads`.

## Resultado
- Julia Atendimentos = total de sessões Julia
- Campanhas Atendimentos = sessões Julia originadas de campanha
- Orgânicos Atendimentos = sessões Julia sem campanha
- Todos os funis usam a mesma unidade, subtração é consistente

