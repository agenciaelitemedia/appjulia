
# Plano: Mini-Funil por Campanha usando Lógica do Dashboard

## Análise do Pedido

O usuário quer que o mini-funil use a **mesma lógica do funil do Dashboard principal**, que:
- Mostra a distribuição de cards por **cada estágio do CRM** (todos os estágios ativos)
- Filtra por `stage_entered_at` no período selecionado
- Conta cards em cada estágio

A diferença é que será **filtrado por campanha** (sourceID + title).

---

## Lógica Atual do Dashboard

```sql
SELECT 
  s.id, s.name, s.color, s.position,
  COUNT(c.id)::int as count
FROM crm_atendimento_stages s
LEFT JOIN crm_atendimento_cards c ON s.id = c.stage_id
  AND c.cod_agent = ANY($1)
  AND (c.stage_entered_at)::date >= $2
  AND (c.stage_entered_at)::date <= $3
WHERE s.is_active = true
GROUP BY s.id, s.name, s.color, s.position
ORDER BY s.position
```

---

## Nova Lógica para Mini-Funil por Campanha

A query precisa:
1. Identificar os leads de cada campanha (sourceID + title)
2. Correlacionar esses leads com cards do CRM via (cod_agent, whatsapp)
3. Contar quantos cards estão em cada estágio do CRM

```sql
WITH campaign_leads AS (
  -- Leads únicos por campanha com whatsapp
  SELECT DISTINCT
    (campaign_data::jsonb)->>'sourceID' || '::' || 
    (campaign_data::jsonb)->>'title' as group_key,
    ca.cod_agent::text,
    COALESCE(
      NULLIF((campaign_data::jsonb)->>'phone', ''),
      s.whatsapp_number::text
    ) as whatsapp
  FROM campaing_ads ca
  LEFT JOIN sessions s ON s.id = ca.session_id::int
  WHERE ca.cod_agent::text = ANY($1)
    AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2
    AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3
    AND (campaign_data::jsonb)->>'sourceID' IS NOT NULL
),

lead_counts AS (
  -- Total de leads por campanha (inclui duplicados)
  SELECT 
    (campaign_data::jsonb)->>'sourceID' || '::' || 
    (campaign_data::jsonb)->>'title' as group_key,
    COUNT(*)::int as total_leads
  FROM campaing_ads
  WHERE cod_agent::text = ANY($1)
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3
    AND (campaign_data::jsonb)->>'sourceID' IS NOT NULL
  GROUP BY group_key
),

-- Cards do CRM que correspondem aos leads de campanhas
crm_cards AS (
  SELECT 
    cl.group_key,
    c.id as card_id,
    c.stage_id
  FROM campaign_leads cl
  INNER JOIN crm_atendimento_cards c 
    ON c.cod_agent = cl.cod_agent 
    AND c.whatsapp_number = cl.whatsapp
),

-- Estágios ativos do CRM
stages AS (
  SELECT id, name, color, position
  FROM crm_atendimento_stages
  WHERE is_active = true
),

-- Contagem por estágio por campanha
stage_counts AS (
  SELECT 
    cc.group_key,
    s.id as stage_id,
    s.name as stage_name,
    s.color as stage_color,
    s.position,
    COUNT(DISTINCT cc.card_id)::int as count
  FROM crm_cards cc
  JOIN stages s ON s.id = cc.stage_id
  GROUP BY cc.group_key, s.id, s.name, s.color, s.position
)

SELECT 
  lc.group_key,
  lc.total_leads,
  COALESCE(
    json_agg(
      json_build_object(
        'stage_id', sc.stage_id,
        'stage_name', sc.stage_name,
        'stage_color', sc.stage_color,
        'position', sc.position,
        'count', sc.count
      ) ORDER BY sc.position
    ) FILTER (WHERE sc.stage_id IS NOT NULL),
    '[]'::json
  ) as stages
FROM lead_counts lc
LEFT JOIN stage_counts sc ON sc.group_key = lc.group_key
GROUP BY lc.group_key, lc.total_leads
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/estrategico/campanhas/types.ts` | Atualizar interface `CampaignFunnelData` para incluir array de estágios |
| `src/pages/estrategico/campanhas/hooks/useCampaignsFunnelByGroup.ts` | Reescrever query para usar lógica do dashboard |
| `src/pages/estrategico/campanhas/components/CampaignMiniFunnel.tsx` | Atualizar para exibir barras de todos os estágios |

---

## Nova Interface TypeScript

```typescript
interface CampaignStageFunnelItem {
  stage_id: number;
  stage_name: string;
  stage_color: string;
  position: number;
  count: number;
}

interface CampaignFunnelData {
  group_key: string;
  total_leads: number;
  stages: CampaignStageFunnelItem[];
}
```

---

## Novo Visual do Mini-Funil

```text
┌──────────────────────────────────────────┐
│  Funil CRM (150 leads)                   │
├──────────────────────────────────────────┤
│  Novo Lead       ████████████████   85   │  azul
│  Análise         ██████████   35         │  verde
│  Negociação      ██████   18             │  amarelo
│  Contrato Curso  ███   8                 │  laranja
│  Assinado        █   4                   │  roxo
└──────────────────────────────────────────┘
```

Cada barra:
- Cor correspondente ao estágio
- Largura proporcional ao count
- Número ao lado
- Tooltip com porcentagem

---

## Considerações Técnicas

1. **JSON Aggregation**: A query retorna os estágios como um array JSON para cada campanha, evitando múltiplas linhas por campanha
2. **Performance**: Uma única query para todas as campanhas, mantendo o padrão de evitar N+1
3. **Compatibilidade**: O componente `CampaignMiniFunnel` será atualizado para receber a nova estrutura
4. **Fallback**: Se não houver cards no CRM para uma campanha, mostra apenas o total de leads
