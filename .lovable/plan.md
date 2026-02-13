

## Plano de Implementação: Corrigir Inconsistência no Funil Orgânico do Dashboard

### Diagnóstico Raiz do Problema

A inconsistência "Em Qualificação > Atendimentos" no funil orgânico ocorre porque:

1. **Funil Julia e Campanhas**: Usam `crm_atendimento_history` para contar leads que **já passaram** por cada estágio (problema da aprovação anterior não implementado)
2. **Cálculo do Funil Orgânico**: Subtrai frontalmente `Organic[stage] = Julia[stage] - Campanhas[stage]` para CADA estágio independentemente
3. **Resultado Matemático Impossível**: Como alguns leads de campanhas estão em estágios avançados e outros não, essa subtração gera números inválidos

**Exemplo prático:**
- Julia em Qualificação: 50 leads
- Campanhas em Qualificação: 5 leads
- Orgânico em Qualificação: 50 - 5 = 45 leads ✓

- Julia Qualificados: 40 leads
- Campanhas Qualificados: 10 leads
- Orgânico Qualificados: 40 - 10 = 30 leads

**Problema**: Os 10 leads de campanha "qualificados" podem vir de campanhas diferentes do pool que gerou os 5 "em qualificação", causando incosistências cumulativas.

### Solução Proposta

Implementar **3 correções em cascata**:

#### 1️⃣ **Corrigir Funis Julia e Campanhas** (usar `stage_id` atual ao invés de `history`)
   - Arquivo: `src/pages/dashboard/hooks/useDashboardFunnels.ts`
   - **Mudança**: Substituir CTEs que usam `crm_atendimento_history` + `h.to_stage_id` por queries que consultam `c.stage_id` (estado atual)
   - **Lógica cumultativa**: Um card é contado em um estágio se sua posição atual `>= posição do estágio alvo`
   - **Resultado**: Funil Julia mostrará "Contratos Gerados = 7" (não 8)

#### 2️⃣ **Criar Funil Orgânico com Query Própria** (não mais subtração)
   - Arquivo: `src/pages/dashboard/hooks/useDashboardFunnels.ts`
   - **Nova função**: `useDashboardOrganicFunnel(filters)`
   - **Estratégia**: Identificar leads que NÃO vieram de campanhas:
     ```sql
     WITH julia_leads AS (...),
     campaign_whatsapp AS (
       SELECT DISTINCT whatsapp FROM campaing_ads WHERE ...
     ),
     organic_leads AS (
       SELECT DISTINCT whatsapp, cod_agent 
       FROM julia_leads 
       WHERE whatsapp NOT IN (SELECT whatsapp FROM campaign_whatsapp)
     )
     -- Contar stages de organic_leads apenas
     ```
   - **Vantagem**: Garante que "Em Qualificação" nunca será maior que "Atendimentos" para leads orgânicos específicos

#### 3️⃣ **Atualizar Componente de Renderização**
   - Arquivo: `src/pages/dashboard/components/DashboardTripleFunnel.tsx`
   - **Mudança**: Substituir `useMemo` que faz subtração por chamada ao novo hook `useDashboardOrganicFunnel`
   - **Adicionalmente**: Passar `organicLoading` do novo hook para renderizar skeleton corretamente

### Detalhes de Implementação

#### **Fase 1: Corrigir Funções Julia e Campanhas**

**Padrão para todos os 4 CTEs de estágio:**

```sql
-- ANTES (problemático - usa history):
em_qualificacao AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM julia_leads jl
  JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
  JOIN crm_atendimento_history h ON h.card_id = c.id
  JOIN crm_atendimento_stages s ON s.id = h.to_stage_id
  WHERE LOWER(s.name) LIKE '%analise%caso%'
)

-- DEPOIS (correto - usa stage_id atual):
em_qualificacao AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM julia_leads jl
  JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
  JOIN crm_atendimento_stages s ON s.id = c.stage_id
  WHERE s.position >= (
    SELECT MIN(position) 
    FROM crm_atendimento_stages 
    WHERE LOWER(name) LIKE '%analise%caso%' OR LOWER(name) LIKE '%análise%caso%'
  )
)
```

**CTEs a atualizar em `useDashboardJuliaFunnel` (linhas 58-89)**:
- `em_qualificacao` (linhas 58-65)
- `qualificados` (linhas 66-73)
- `contratos_gerados` (linhas 74-81)
- `contratos_assinados` (linhas 82-89)

**CTEs a atualizar em `useDashboardCampaignFunnel` (linhas 136-176)**:
- Mesmo padrão, mas com `campaign_leads` ao invés de `julia_leads`

#### **Fase 2: Criar Nova Função `useDashboardOrganicFunnel`**

```typescript
export function useDashboardOrganicFunnel(filters: UnifiedFiltersState) {
  return useQuery({
    queryKey: ['dashboard-organic-funnel', filters.agentCodes, filters.dateFrom, filters.dateTo],
    queryFn: async () => {
      if (!filters.agentCodes.length) return [];

      const result = await externalDb.raw<RawFunnelRow>({
        query: `
          WITH julia_leads AS (
            SELECT DISTINCT whatsapp::text, cod_agent::text
            FROM vw_desempenho_julia
            WHERE cod_agent::text = ANY($1::varchar[])
              AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          ),
          campaign_whatsapp AS (
            SELECT DISTINCT COALESCE(
              NULLIF((campaign_data::jsonb)->>'phone', ''),
              s.whatsapp_number::text
            ) as whatsapp
            FROM campaing_ads ca
            LEFT JOIN sessions s ON s.id = ca.session_id::int
            WHERE ca.cod_agent::text = ANY($1::text[])
              AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2
              AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3
              AND COALESCE(
                NULLIF((campaign_data::jsonb)->>'phone', ''),
                s.whatsapp_number::text
              ) IS NOT NULL
          ),
          organic_leads AS (
            SELECT DISTINCT whatsapp, cod_agent
            FROM julia_leads
            WHERE whatsapp NOT IN (SELECT whatsapp FROM campaign_whatsapp)
          ),
          atendimentos AS (
            SELECT COUNT(DISTINCT whatsapp)::int as count FROM organic_leads
          ),
          em_qualificacao AS (
            SELECT COUNT(DISTINCT c.id)::int as count
            FROM organic_leads ol
            JOIN crm_atendimento_cards c ON c.cod_agent = ol.cod_agent AND c.whatsapp_number = ol.whatsapp
            JOIN crm_atendimento_stages s ON s.id = c.stage_id
            WHERE s.position >= (
              SELECT MIN(position) 
              FROM crm_atendimento_stages 
              WHERE LOWER(name) LIKE '%analise%caso%' OR LOWER(name) LIKE '%análise%caso%'
            )
          ),
          -- ... repetir para qualificados, contratos_gerados, contratos_assinados
          SELECT 'Atendimentos' as stage_name, '#22c55e' as stage_color, 0 as position, (SELECT count FROM atendimentos) as count
          UNION ALL SELECT 'Em Qualificação', '#eab308', 1, (SELECT count FROM em_qualificacao)
          -- ... resto dos UNION ALL
          ORDER BY position
        `,
        params: [filters.agentCodes, filters.dateFrom, filters.dateTo],
      });

      return toFunnelStages(result);
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
```

#### **Fase 3: Atualizar Dashboard e Triple Funnel**

**Em `src/pages/Dashboard.tsx` (linha 75)**:
```typescript
// Adicionar nova query
const { data: organicFunnel = [], isLoading: organicFunnelLoading } = useDashboardOrganicFunnel(filters);
```

**Em `src/pages/dashboard/components/DashboardTripleFunnel.tsx` (linhas 133-150)**:
```typescript
// Receber organicData via props ao invés de calcular com useMemo
interface DashboardTripleFunnelProps {
  juliaData: DashboardFunnelStage[];
  campaignData: DashboardFunnelStage[];
  organicData: DashboardFunnelStage[];  // NOVO
  juliaLoading: boolean;
  campaignLoading: boolean;
  organicLoading: boolean;  // NOVO
}

// Remover useMemo, usar props direto
export function DashboardTripleFunnel({ 
  juliaData, 
  campaignData, 
  organicData,  // NOVO
  juliaLoading, 
  campaignLoading,
  organicLoading  // NOVO
}: DashboardTripleFunnelProps) {
  // Remover const organicData = useMemo(...)
  
  return (
    <FunnelCard
      title="Funil Orgânicos"
      icon={<Leaf ... />}
      stages={organicData}  // Usar prop ao invés de estado calculado
      isLoading={organicLoading}
    />
  );
}
```

**Em `src/pages/Dashboard.tsx` (linhas 339-341)**:
```typescript
<DashboardTripleFunnel
  juliaData={juliaFunnel}
  campaignData={campaignFunnel}
  organicData={organicFunnel}        // NOVO
  juliaLoading={juliaFunnelLoading}
  campaignLoading={campaignFunnelLoading}
  organicLoading={organicFunnelLoading}  // NOVO
/>
```

### Sequência de Implementação

1. ✅ Atualizar `useDashboardFunnels.ts` - corrigir Julia e Campanhas
2. ✅ Criar `useDashboardOrganicFunnel` em `useDashboardFunnels.ts`
3. ✅ Importar novo hook em `Dashboard.tsx`
4. ✅ Adicionar query do organic funnel em `Dashboard.tsx`
5. ✅ Atualizar interface e lógica de `DashboardTripleFunnel.tsx`
6. ✅ Passar props corretas em `Dashboard.tsx` para o componente

### Resultados Esperados

- ✅ **Funil Julia**: Contratos Gerados = 7 (alinhado com card e página de contratos)
- ✅ **Funil Orgânico**: "Em Qualificação" ≤ "Atendimentos" (sempre válido matematicamente)
- ✅ **Funil Campanhas**: Valores coerentes com a origem dos leads
- ✅ **Consistência**: Todas as três visualizações de funil no dashboard têm números válidos e alinhados com a realidade

