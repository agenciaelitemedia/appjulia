

# Plano: Corrigir Funil de Campanhas com JOIN via Sessions

## Problema Identificado

O funil de campanhas precisa relacionar leads de campanhas com os estágios do CRM. A tabela `crm_atendimento_cards` não tem `session_id` direto, mas possui `whatsapp_number` e `cod_agent`.

## Estrutura de Relacionamento

```text
campaing_ads.session_id
        ↓
    sessions.id
        ↓
sessions.whatsapp_number + agents.cod_agent
        ↓
crm_atendimento_cards.whatsapp_number + cod_agent
        ↓
crm_atendimento_stages (funil)
```

---

## Solução: Query com JOINs Corrigidos

A nova query do funil vai:
1. Buscar leads de campanhas (`campaing_ads`)
2. Relacionar com sessões (`sessions`) via `session_id`
3. Pegar o número do WhatsApp da sessão
4. Relacionar com cards do CRM via `whatsapp_number` + `cod_agent`
5. Agrupar por estágio para montar o funil

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/estrategico/campanhas/hooks/useCampanhasData.ts` | Atualizar query do `useCampanhasFunnel` |

---

## Nova Query SQL

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
campaign_leads_in_crm AS (
  -- Encontrar cards do CRM que vieram de campanhas
  SELECT 
    c.id,
    c.stage_id,
    c.whatsapp_number,
    c.cod_agent
  FROM crm_atendimento_cards c
  WHERE EXISTS (
    SELECT 1 FROM campaign_sessions cs 
    WHERE cs.whatsapp_number = c.whatsapp_number::text
      AND cs.cod_agent = c.cod_agent
  )
),
funnel_stages AS (
  -- Agregar por estágio
  SELECT 
    s.name as stage_name,
    s.color as stage_color,
    s.position,
    COUNT(cl.id)::int as count
  FROM crm_atendimento_stages s
  LEFT JOIN campaign_leads_in_crm cl ON cl.stage_id = s.id
  WHERE s.is_active = true
  GROUP BY s.id, s.name, s.color, s.position
)
SELECT * FROM funnel_stages
WHERE count > 0
ORDER BY position ASC
```

---

## Lógica do Funil

| Estágio | Descrição |
|---------|-----------|
| Leads Captados | Total de registros em `campaing_ads` |
| Novo Lead | Cards no CRM vindos de campanhas |
| Em Análise | Cards neste estágio vindos de campanhas |
| Qualificado | Cards neste estágio vindos de campanhas |
| ... | Demais estágios do CRM |
| Contrato Assinado | Conversões finais |

---

## Fallback Seguro

Caso o JOIN não retorne dados (ex: `session_id` inválido ou dados inconsistentes), manter o funil simplificado atual como fallback:

```typescript
// Se a query principal falhar ou retornar vazio,
// usar funil baseado apenas em campaing_ads
const simpleFunnel = [
  { stage_name: 'Leads Captados', count: totalCampaignLeads, ... },
  { stage_name: 'Com Sessão', count: distinctSessions, ... },
  { stage_name: 'Ads Diretos', count: ctwaDirect, ... },
];
```

---

## Resultado Esperado

1. Funil mostrando a progressão real dos leads de campanha pelo CRM
2. Visualização clara da conversão em cada estágio
3. Taxas de conversão entre etapas calculadas automaticamente
4. Fallback para dados básicos se não houver match no CRM

