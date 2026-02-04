

# Plano: Mini-Funil de Conversao por Campanha

## Visao Geral

Adicionar um grafico de barras horizontais em cada card de campanha na aba "Campanhas", mostrando o funil de conversao especifico daquela campanha. O funil tera 3 etapas:
- **Total de Leads**: Todos os leads da campanha
- **Qualificados**: Leads que chegaram aos estagios Negociacao, Contrato em Curso ou Contrato Assinado
- **Clientes**: Leads que chegaram ao estagio Contrato Assinado

---

## Arquitetura da Solucao

```text
┌─────────────────────────────────────────────────────────────┐
│  CampanhasListTab                                           │
│  ├── useCampanhasDetails (dados agrupados)                  │
│  └── useCampaignsFunnelByGroup (funil por campanha) [NOVO]  │
│      └── CampaignDetailCard                                 │
│          └── CampaignMiniFunnel [NOVO]                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Etapa 1: Criar Hook para Funil por Campanha

**Novo arquivo: `src/pages/estrategico/campanhas/hooks/useCampaignsFunnelByGroup.ts`**

Este hook buscara os dados de funil agregados por `campaign_id` (sourceID + title), retornando para cada campanha:
- Total de leads
- Leads qualificados
- Leads clientes

```sql
WITH campaign_leads AS (
  -- Agrupa leads por campanha com dados para join com CRM
  SELECT 
    campaign_data->>'sourceID' || '::' || campaign_data->>'title' as group_key,
    ca.cod_agent::text,
    COALESCE(
      NULLIF(campaign_data->>'phone', ''),
      s.whatsapp_number::text
    ) as whatsapp,
    COUNT(*)::int as total_leads
  FROM campaing_ads ca
  LEFT JOIN sessions s ON s.id = ca.session_id::int
  WHERE ca.cod_agent::text = ANY($1)
    AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2
    AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3
    AND campaign_data->>'sourceID' IS NOT NULL
  GROUP BY group_key, cod_agent, whatsapp
),

qualified_stages AS (
  SELECT id FROM crm_atendimento_stages 
  WHERE name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
),

cliente_stage AS (
  SELECT id FROM crm_atendimento_stages 
  WHERE name = 'Contrato Assinado'
)

SELECT 
  group_key,
  SUM(total_leads)::int as total_leads,
  COUNT(DISTINCT CASE WHEN c.stage_id IN (SELECT id FROM qualified_stages) 
                      THEN c.id END)::int as qualified,
  COUNT(DISTINCT CASE WHEN c.stage_id IN (SELECT id FROM cliente_stage) 
                      THEN c.id END)::int as clients
FROM campaign_leads cl
LEFT JOIN crm_atendimento_cards c 
  ON c.cod_agent = cl.cod_agent 
  AND c.whatsapp_number = cl.whatsapp
GROUP BY group_key
```

Interface de retorno:
```typescript
interface CampaignFunnelData {
  group_key: string; // campaign_id::campaign_title
  total_leads: number;
  qualified: number;
  clients: number;
}
```

---

## Etapa 2: Criar Componente de Mini-Funil

**Novo arquivo: `src/pages/estrategico/campanhas/components/CampaignMiniFunnel.tsx`**

Componente compacto com 3 barras horizontais representando o funil:

```text
┌──────────────────────────────────────────┐
│  Funil de Conversao                      │
│  ┌────────────────────────────────┐      │
│  │██████████████████████████████  │ 150  │ Total
│  └────────────────────────────────┘      │
│  ┌──────────────────┐                    │
│  │████████████████  │ 45 (30%)          │ Qualificados
│  └──────────────────┘                    │
│  ┌───────┐                               │
│  │██████ │ 12 (8%)                      │ Clientes
│  └───────┘                               │
└──────────────────────────────────────────┘
```

Caracteristicas:
- Barras com cores do funil principal (azul, laranja, roxo)
- Largura proporcional ao total de leads
- Percentual de conversao ao lado de cada barra
- Skeleton loading enquanto carrega
- Estado vazio quando nao ha dados

---

## Etapa 3: Atualizar CampanhasListTab

**Arquivo: `src/pages/estrategico/campanhas/components/CampanhasListTab.tsx`**

Modificacoes:
1. Importar e usar o novo hook `useCampaignsFunnelByGroup`
2. Criar um Map para lookup rapido dos dados de funil por `group_key`
3. Passar os dados de funil para cada `CampaignDetailCard`

```typescript
const { data: funnelData = [] } = useCampaignsFunnelByGroup(filters);

// Criar Map para lookup O(1)
const funnelMap = useMemo(() => {
  const map = new Map<string, CampaignFunnelData>();
  funnelData.forEach(f => map.set(f.group_key, f));
  return map;
}, [funnelData]);

// Passar para o card
<CampaignDetailCard
  campaign={campaign}
  funnelData={funnelMap.get(`${campaign.campaign_id}::${campaign.campaign_title}`)}
/>
```

---

## Etapa 4: Atualizar CampaignDetailCard

**Arquivo: `src/pages/estrategico/campanhas/components/CampaignDetailCard.tsx`**

Modificacoes:
1. Adicionar prop `funnelData` opcional
2. Renderizar o `CampaignMiniFunnel` apos o `ExpandableSources`

```typescript
interface CampaignDetailCardProps {
  campaign: CampaignDetailGrouped;
  funnelData?: CampaignFunnelData;
}

// No render, apos ExpandableSources:
{funnelData && (
  <CampaignMiniFunnel data={funnelData} />
)}
```

---

## Etapa 5: Atualizar Types

**Arquivo: `src/pages/estrategico/campanhas/types.ts`**

Adicionar nova interface:

```typescript
export interface CampaignFunnelData {
  group_key: string;
  total_leads: number;
  qualified: number;
  clients: number;
}
```

---

## Arquivos a Modificar/Criar

| Arquivo | Acao |
|---------|------|
| `src/pages/estrategico/campanhas/hooks/useCampaignsFunnelByGroup.ts` | CRIAR - Hook para buscar funil por campanha |
| `src/pages/estrategico/campanhas/components/CampaignMiniFunnel.tsx` | CRIAR - Componente visual do mini-funil |
| `src/pages/estrategico/campanhas/components/CampanhasListTab.tsx` | MODIFICAR - Integrar hook e passar dados |
| `src/pages/estrategico/campanhas/components/CampaignDetailCard.tsx` | MODIFICAR - Renderizar mini-funil |
| `src/pages/estrategico/campanhas/types.ts` | MODIFICAR - Adicionar interface |

---

## Visual Final do Card

```text
┌─────────────────────────────────────────┐
│ [123] - Escritorio ABC          👥 150  │ Header
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │     [Thumbnail da Campanha]     │   │
│  │  FB   IG                   📱   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Titulo da Campanha                     │
│  Descricao expandivel...                │
│                                         │
│  ┌─ Frase do lead: ─────────────────┐  │
│  │ "Gostaria de saber mais..."      │  │
│  └──────────────────────────────────┘  │
│                                         │
│  Ultimo lead: 01/02/26 as 14:30        │
│                                         │
│  [🔗 Acessar] [📋]                      │
│                                         │
│  ▼ 5 fontes diferentes                  │
│                                         │
│  ┌─ Funil de Conversao ─────────────┐  │ NOVO
│  │ Total      █████████████████ 150 │  │
│  │ Qualific.  ██████ 45 (30%)       │  │
│  │ Clientes   ██ 12 (8%)            │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## Consideracoes de Performance

1. **Query Otimizada**: O hook busca todos os funis de uma vez, evitando N+1 queries
2. **Memoizacao**: O Map de lookup e criado com useMemo para evitar recalculos
3. **Lazy Loading**: O mini-funil so renderiza se `funnelData` existir
4. **Skeleton**: Loading state individual para cada card enquanto dados carregam

