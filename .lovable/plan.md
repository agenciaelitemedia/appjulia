

# Plano: Ajustar Funil de Conversao de Campanhas Ads

## Visao Geral

Reconfigurar o funil de conversao da pagina de Campanhas Ads com 5 etapas claramente definidas, cada uma com sua regra de quantitativo baseada em tabelas especificas do banco externo.

---

## Novas Etapas do Funil

| Etapa | Nome | Regra de Contagem |
|-------|------|-------------------|
| 1 | **Entrada** | Total de leads que entraram pelas campanhas (`campaing_ads`) |
| 2 | **Atendidos por JulIA** | Leads com referencia na tabela `log_first_messages` (ligacao por `cod_agent` e `whatsapp`) |
| 3 | **Em Qualificacao** | Leads na `crm_atendimento_cards` que passaram pela fase "Analise de Caso" (verificar em `crm_atendimento_history`) |
| 4 | **Qualificado** | Leads em `crm_atendimento_cards` nas fases: Negociacao + Contrato em Curso + Contrato Assinado |
| 5 | **Cliente** | Leads em `crm_atendimento_cards` na fase: Contrato Assinado |

---

## Modificacoes Necessarias

### 1. Atualizar `useCampanhasData.ts` - Hook `useCampanhasFunnel`

Nova query SQL com as 5 etapas definidas:

```sql
WITH campaign_leads AS (
  -- Todos os leads de campanhas no periodo
  SELECT DISTINCT
    ca.id,
    ca.cod_agent::text,
    COALESCE(
      NULLIF(campaign_data->>'phone', ''),
      s.whatsapp_number::text
    ) as whatsapp
  FROM campaing_ads ca
  LEFT JOIN sessions s ON s.id = ca.session_id::int
  WHERE ca.cod_agent::text = ANY($1::varchar[])
    AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
    AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
),

-- Etapa 1: Entrada (total de leads de campanhas)
entrada AS (
  SELECT COUNT(*)::int as count FROM campaign_leads
),

-- Etapa 2: Atendidos por JulIA (leads com registro em log_first_messages)
atendidos AS (
  SELECT COUNT(DISTINCT cl.id)::int as count
  FROM campaign_leads cl
  WHERE EXISTS (
    SELECT 1 FROM log_first_messages lfm
    WHERE lfm.cod_agent::text = cl.cod_agent
      AND lfm.whatsapp::text = cl.whatsapp
  )
),

-- Etapa 3: Em Qualificacao (leads que passaram por "Analise de Caso")
em_qualificacao AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM campaign_leads cl
  JOIN crm_atendimento_cards c 
    ON c.cod_agent = cl.cod_agent 
    AND c.whatsapp_number = cl.whatsapp
  JOIN crm_atendimento_history h ON h.card_id = c.id
  JOIN crm_atendimento_stages s ON s.id = h.to_stage_id
  WHERE LOWER(s.name) LIKE '%analise%caso%' 
     OR LOWER(s.name) LIKE '%análise%caso%'
),

-- IDs dos estagios de qualificacao
qualified_stage_ids AS (
  SELECT id FROM crm_atendimento_stages 
  WHERE name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
),

-- Etapa 4: Qualificado (Negociacao + Contrato em Curso + Contrato Assinado)
qualificado AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM campaign_leads cl
  JOIN crm_atendimento_cards c 
    ON c.cod_agent = cl.cod_agent 
    AND c.whatsapp_number = cl.whatsapp
  WHERE c.stage_id IN (SELECT id FROM qualified_stage_ids)
),

-- ID do estagio "Contrato Assinado"
cliente_stage_id AS (
  SELECT id FROM crm_atendimento_stages 
  WHERE name = 'Contrato Assinado'
),

-- Etapa 5: Cliente (apenas Contrato Assinado)
cliente AS (
  SELECT COUNT(DISTINCT c.id)::int as count
  FROM campaign_leads cl
  JOIN crm_atendimento_cards c 
    ON c.cod_agent = cl.cod_agent 
    AND c.whatsapp_number = cl.whatsapp
  WHERE c.stage_id IN (SELECT id FROM cliente_stage_id)
)

-- Resultado final do funil
SELECT 'Entrada' as stage_name, '#3b82f6' as stage_color, 0 as position, (SELECT count FROM entrada) as count
UNION ALL
SELECT 'Atendidos por JulIA', '#22c55e', 1, (SELECT count FROM atendidos)
UNION ALL
SELECT 'Em Qualificação', '#eab308', 2, (SELECT count FROM em_qualificacao)
UNION ALL
SELECT 'Qualificado', '#f97316', 3, (SELECT count FROM qualificado)
UNION ALL
SELECT 'Cliente', '#8b5cf6', 4, (SELECT count FROM cliente)
ORDER BY position
```

### 2. Atualizar `CampanhasFunnelChart.tsx` - Valores Default

Ajustar os `defaultStages` para refletir as 5 novas etapas:

```typescript
const defaultStages: CampaignFunnelStage[] = [
  { stage_name: 'Entrada', stage_color: '#3b82f6', position: 0, count: 0, percentage: 100, conversionRate: 100 },
  { stage_name: 'Atendidos por JulIA', stage_color: '#22c55e', position: 1, count: 0, percentage: 0, conversionRate: 0 },
  { stage_name: 'Em Qualificação', stage_color: '#eab308', position: 2, count: 0, percentage: 0, conversionRate: 0 },
  { stage_name: 'Qualificado', stage_color: '#f97316', position: 3, count: 0, percentage: 0, conversionRate: 0 },
  { stage_name: 'Cliente', stage_color: '#8b5cf6', position: 4, count: 0, percentage: 0, conversionRate: 0 },
];
```

### 3. Remover Fallback Antigo

Remover a funcao `getFallbackFunnel` que usava logica simplificada, pois agora o funil tera etapas fixas e claras.

---

## Fluxo de Dados Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│                       FUNIL DE CONVERSAO                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ ENTRADA                                    1.250 leads │     │
│  │ Total de leads que entraram via campanhas             │     │
│  │ (tabela: campaing_ads)                                │     │
│  └───────────────────────────────────────────────────────┘     │
│                           ↓ 72%                                 │
│  ┌────────────────────────────────────────────────────┐        │
│  │ ATENDIDOS POR JULIA                       900 leads │        │
│  │ Leads com registro em log_first_messages           │        │
│  │ (tabela: log_first_messages)                       │        │
│  └────────────────────────────────────────────────────┘        │
│                           ↓ 56%                                 │
│  ┌─────────────────────────────────────────────┐               │
│  │ EM QUALIFICACAO                   500 leads │               │
│  │ Leads que passaram por Analise de Caso     │               │
│  │ (tabela: crm_atendimento_history)          │               │
│  └─────────────────────────────────────────────┘               │
│                           ↓ 40%                                 │
│  ┌──────────────────────────────────────┐                      │
│  │ QUALIFICADO              200 leads   │                      │
│  │ Negociacao + Contrato em Curso +     │                      │
│  │ Contrato Assinado                    │                      │
│  └──────────────────────────────────────┘                      │
│                           ↓ 25%                                 │
│  ┌──────────────────────────────┐                              │
│  │ CLIENTE           50 leads   │                              │
│  │ Contrato Assinado            │                              │
│  └──────────────────────────────┘                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/estrategico/campanhas/hooks/useCampanhasData.ts` | Reescrever `useCampanhasFunnel` com nova query e remover `getFallbackFunnel` |
| `src/pages/estrategico/campanhas/components/CampanhasFunnelChart.tsx` | Atualizar `defaultStages` com as 5 novas etapas |

---

## Detalhes das Regras de Join

### Ligacao Campanhas -> Log First Messages
- `campaing_ads.cod_agent` = `log_first_messages.cod_agent`
- `campaing_ads.whatsapp` (via session ou campo phone) = `log_first_messages.whatsapp`

### Ligacao Campanhas -> CRM Cards
- `campaing_ads.cod_agent` = `crm_atendimento_cards.cod_agent`
- `campaing_ads.whatsapp` = `crm_atendimento_cards.whatsapp_number`

### Verificacao de "Analise de Caso"
- Join `crm_atendimento_cards` com `crm_atendimento_history` via `card_id`
- Join `crm_atendimento_history` com `crm_atendimento_stages` via `to_stage_id`
- Filtrar onde `stage.name` contem "Analise" e "Caso" (case insensitive)

---

## Cores do Funil

| Etapa | Cor | Hex |
|-------|-----|-----|
| Entrada | Azul | `#3b82f6` |
| Atendidos por JulIA | Verde | `#22c55e` |
| Em Qualificacao | Amarelo | `#eab308` |
| Qualificado | Laranja | `#f97316` |
| Cliente | Roxo | `#8b5cf6` |

---

## Resultado Esperado

1. Funil exibira exatamente 5 etapas com nomes e cores claras
2. Cada etapa tera contagem precisa baseada nas regras definidas
3. Taxa de conversao entre etapas calculada automaticamente
4. Percentual relativo ao total (primeira etapa) exibido em cada barra
5. Tooltips detalhados com contagem, percentual e taxa de conversao

