
# Plano: Funil de Conversão de 5 Etapas por Campanha

## Objetivo

Trazer para o card de campanha o mesmo **Funil de Conversão** do dashboard principal, mantendo as 5 etapas definidas:

1. **Entrada** - Total de leads da campanha
2. **Atendidos por JulIA** - Leads com registro em `log_first_messages`
3. **Em Qualificação** - Leads que passaram por "Análise de Caso"
4. **Qualificado** - Negociação + Contrato em Curso + Contrato Assinado
5. **Cliente** - Contrato Assinado

---

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│  CampanhasListTab                                           │
│  └── useCampaignsFunnelByGroup (5 etapas por campanha)      │
│      └── CampaignDetailCard                                 │
│          └── CampaignMiniFunnel (5 etapas visuais)          │
└─────────────────────────────────────────────────────────────┘
```

---

## Etapa 1: Atualizar Types

**Arquivo: `src/pages/estrategico/campanhas/types.ts`**

Atualizar a interface `CampaignFunnelData` para refletir as 5 etapas fixas:

```typescript
export interface CampaignFunnelData {
  group_key: string;
  total_leads: number;
  atendidos: number;
  em_qualificacao: number;
  qualificado: number;
  cliente: number;
}
```

---

## Etapa 2: Reescrever Hook do Funil por Campanha

**Arquivo: `src/pages/estrategico/campanhas/hooks/useCampaignsFunnelByGroup.ts`**

Usar a mesma lógica do `useCampanhasFunnel`, mas agrupada por `group_key` (sourceID::title):

```sql
WITH campaign_leads AS (
  -- Leads por campanha com whatsapp para correlação
  SELECT 
    ((campaign_data::jsonb)->>'sourceID') || '::' || 
    ((campaign_data::jsonb)->>'title') as group_key,
    ca.id,
    ca.cod_agent::text,
    COALESCE(
      NULLIF((campaign_data::jsonb)->>'phone', ''),
      s.whatsapp_number::text
    ) as whatsapp
  FROM campaing_ads ca
  LEFT JOIN sessions s ON s.id = ca.session_id::int
  WHERE ca.cod_agent::text = ANY($1::text[])
    AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2
    AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3
    AND (campaign_data::jsonb)->>'sourceID' IS NOT NULL
),

-- Total de leads por campanha (Entrada)
entrada AS (
  SELECT group_key, COUNT(*)::int as count
  FROM campaign_leads
  GROUP BY group_key
),

-- Atendidos por JulIA
atendidos AS (
  SELECT 
    cl.group_key,
    COUNT(DISTINCT cl.id)::int as count
  FROM campaign_leads cl
  WHERE EXISTS (
    SELECT 1 FROM log_first_messages lfm
    WHERE lfm.cod_agent::text = cl.cod_agent
      AND lfm.whatsapp::text = cl.whatsapp
  )
  GROUP BY cl.group_key
),

-- Em Qualificação (passaram por Análise de Caso)
em_qualificacao AS (
  SELECT 
    cl.group_key,
    COUNT(DISTINCT c.id)::int as count
  FROM campaign_leads cl
  JOIN crm_atendimento_cards c 
    ON c.cod_agent = cl.cod_agent 
    AND c.whatsapp_number = cl.whatsapp
  JOIN crm_atendimento_history h ON h.card_id = c.id
  JOIN crm_atendimento_stages s ON s.id = h.to_stage_id
  WHERE LOWER(s.name) LIKE '%analise%caso%' 
     OR LOWER(s.name) LIKE '%análise%caso%'
  GROUP BY cl.group_key
),

-- IDs dos estágios de qualificação
qualified_stage_ids AS (
  SELECT id FROM crm_atendimento_stages 
  WHERE name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
),

-- Qualificado
qualificado AS (
  SELECT 
    cl.group_key,
    COUNT(DISTINCT c.id)::int as count
  FROM campaign_leads cl
  JOIN crm_atendimento_cards c 
    ON c.cod_agent = cl.cod_agent 
    AND c.whatsapp_number = cl.whatsapp
  WHERE c.stage_id IN (SELECT id FROM qualified_stage_ids)
  GROUP BY cl.group_key
),

-- Cliente (Contrato Assinado)
cliente_stage_id AS (
  SELECT id FROM crm_atendimento_stages 
  WHERE name = 'Contrato Assinado'
),

cliente AS (
  SELECT 
    cl.group_key,
    COUNT(DISTINCT c.id)::int as count
  FROM campaign_leads cl
  JOIN crm_atendimento_cards c 
    ON c.cod_agent = cl.cod_agent 
    AND c.whatsapp_number = cl.whatsapp
  WHERE c.stage_id IN (SELECT id FROM cliente_stage_id)
  GROUP BY cl.group_key
)

SELECT 
  e.group_key,
  e.count as total_leads,
  COALESCE(a.count, 0)::int as atendidos,
  COALESCE(eq.count, 0)::int as em_qualificacao,
  COALESCE(q.count, 0)::int as qualificado,
  COALESCE(c.count, 0)::int as cliente
FROM entrada e
LEFT JOIN atendidos a ON a.group_key = e.group_key
LEFT JOIN em_qualificacao eq ON eq.group_key = e.group_key
LEFT JOIN qualificado q ON q.group_key = e.group_key
LEFT JOIN cliente c ON c.group_key = e.group_key
```

---

## Etapa 3: Atualizar CampaignMiniFunnel

**Arquivo: `src/pages/estrategico/campanhas/components/CampaignMiniFunnel.tsx`**

Renderizar as 5 etapas fixas com as mesmas cores do funil principal:

```text
┌──────────────────────────────────────────┐
│  Funil de Conversão                      │
├──────────────────────────────────────────┤
│  Entrada         ████████████████   150  │  #3b82f6 (azul)
│  Atendidos JulIA ██████████   85 (57%)   │  #22c55e (verde)
│  Em Qualificação ██████   35 (23%)       │  #eab308 (amarelo)
│  Qualificado     ███   18 (12%)          │  #f97316 (laranja)
│  Cliente         █   4 (3%)              │  #8b5cf6 (roxo)
└──────────────────────────────────────────┘
```

Características:
- Cores idênticas ao funil do dashboard
- Largura proporcional ao total de leads
- Percentual calculado sobre o total (Entrada)
- Tooltips com descrições das etapas

---

## Etapa 4: Atualizar CampaignDetailCard

**Arquivo: `src/pages/estrategico/campanhas/components/CampaignDetailCard.tsx`**

Manter a integração existente - o componente já recebe e renderiza o `CampaignMiniFunnel`.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `types.ts` | Atualizar `CampaignFunnelData` com 5 campos numéricos |
| `useCampaignsFunnelByGroup.ts` | Reescrever query com lógica de 5 etapas |
| `CampaignMiniFunnel.tsx` | Renderizar 5 barras fixas com cores do dashboard |

---

## Visual Final

```text
┌─────────────────────────────────────────┐
│ [123] - Escritório ABC          👥 150  │
├─────────────────────────────────────────┤
│  [Thumbnail da Campanha]                │
├─────────────────────────────────────────┤
│  Título da Campanha                     │
│  Descrição...                           │
│  [Acessar] [📋]                         │
│  ▼ 5 fontes                             │
├─────────────────────────────────────────┤
│  Funil de Conversão                     │
│  ────────────────────────────────────   │
│  Entrada          ██████████████  150   │
│  Atendidos JulIA  █████████   85 (57%)  │
│  Em Qualificação  █████   35 (23%)      │
│  Qualificado      ██   18 (12%)         │
│  Cliente          █   4 (3%)            │
└─────────────────────────────────────────┘
```
