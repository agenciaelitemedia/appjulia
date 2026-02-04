
# Plano: Corrigir Query de Leads e Adicionar Sub-filtro por Campanha

## Problema Identificado

O erro `column s.name does not exist` ocorre porque a tabela `sessions` não possui a coluna `name`. A query atual tenta buscar o nome do contato diretamente de `sessions`, mas essa coluna não existe nessa tabela.

## Solução

Iniciar a query pelas campanhas (`campaing_ads`) e buscar o nome do contato através da tabela `crm_atendimento_cards`, que possui a coluna `contact_name`. Além disso, adicionar um sub-filtro específico para a aba Leads permitindo filtrar por campanha.

---

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│  CampanhasPage.tsx                                          │
│  └── CampanhasLeadsTab.tsx                                  │
│      ├── useCampanhasLeadsList (CORRIGIR query)             │
│      ├── Sub-filtro de Campanha (NOVO Select)               │
│      └── Tabela com dados corrigidos                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Etapa 1: Corrigir Query no Hook

**Arquivo: `src/pages/estrategico/campanhas/hooks/useCampanhasLeadsList.ts`**

A query atual:
```sql
LEFT JOIN sessions s ON s.id = ca.session_id::int
COALESCE(s.name, 'Sem nome') as contact_name  -- ERRO: s.name não existe
```

Nova query - buscar nome do contato via `crm_atendimento_cards`:
```sql
WITH campaign_leads AS (
  SELECT 
    ca.id,
    ca.cod_agent::text as cod_agent,
    ca.created_at,
    COALESCE(
      NULLIF((ca.campaign_data::jsonb)->>'phone', ''),
      s.whatsapp_number::text
    ) as whatsapp,
    (ca.campaign_data::jsonb)->>'title' as campaign_title,
    (ca.campaign_data::jsonb)->>'sourceID' as campaign_id,
    COALESCE((ca.campaign_data::jsonb)->>'sourceApp', 'outros') as platform,
    (ca.campaign_data::jsonb)->>'greetingMessageBody' as greeting_message,
    COALESCE(c.name, 'Escritório') as office_name
  FROM campaing_ads ca
  LEFT JOIN sessions s ON s.id = ca.session_id::int
  LEFT JOIN agents a ON a.cod_agent = ca.cod_agent
  LEFT JOIN clients c ON c.id = a.client_id
  WHERE ca.cod_agent::text = ANY($1::varchar[])
    AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
    AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
)
SELECT 
  cl.id,
  cl.cod_agent,
  cl.created_at,
  cl.whatsapp,
  COALESCE(crm.contact_name, 'Sem nome') as contact_name,
  cl.campaign_title,
  cl.campaign_id,
  cl.platform,
  cl.greeting_message,
  cl.office_name
FROM campaign_leads cl
LEFT JOIN crm_atendimento_cards crm 
  ON crm.whatsapp_number::text = cl.whatsapp 
  AND crm.cod_agent = cl.cod_agent
ORDER BY cl.created_at DESC
```

**Lógica:**
1. CTE `campaign_leads` extrai todos os dados da campanha
2. LEFT JOIN com `crm_atendimento_cards` para buscar o `contact_name` pelo WhatsApp
3. Se não encontrar no CRM, exibe "Sem nome"

---

## Etapa 2: Adicionar Parâmetro de Filtro por Campanha

**Arquivo: `src/pages/estrategico/campanhas/hooks/useCampanhasLeadsList.ts`**

Adicionar parâmetro opcional `campaignId` à interface:

```typescript
interface LeadsListFilters extends UnifiedFiltersState {
  campaignId?: string; // Para filtrar por campanha específica
}

export function useCampanhasLeadsList(filters: LeadsListFilters) {
  // Adicionar condição na query se campaignId estiver preenchido
  // WHERE ... AND (campaign_data->>'sourceID' = $4 OR $4 IS NULL)
}
```

---

## Etapa 3: Criar Hook para Listar Campanhas Disponíveis

**Arquivo: `src/pages/estrategico/campanhas/hooks/useCampanhasOptions.ts`** (NOVO)

Hook simples para buscar as campanhas únicas do período (para popular o Select):

```typescript
export function useCampanhasOptions(filters: UnifiedFiltersState) {
  return useQuery({
    queryKey: ['campanhas-options', filters],
    queryFn: async () => {
      const query = `
        SELECT DISTINCT 
          (campaign_data::jsonb)->>'sourceID' as campaign_id,
          (campaign_data::jsonb)->>'title' as campaign_title,
          COUNT(*)::int as lead_count
        FROM campaing_ads
        WHERE cod_agent::text = ANY($1::varchar[])
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          AND (campaign_data::jsonb)->>'sourceID' IS NOT NULL
        GROUP BY campaign_id, campaign_title
        ORDER BY lead_count DESC
      `;
      // retorna lista de { campaign_id, campaign_title, lead_count }
    }
  });
}
```

---

## Etapa 4: Adicionar Sub-filtro na Aba Leads

**Arquivo: `src/pages/estrategico/campanhas/components/CampanhasLeadsTab.tsx`**

Adicionar um Select acima da tabela para filtrar por campanha:

```text
┌─────────────────────────────────────────────────────────────┐
│  Leads de Campanhas                           (150 leads)   │
├─────────────────────────────────────────────────────────────┤
│  [🔍 Buscar...]  [Campanha: Todas ▼]                        │
├─────────────────────────────────────────────────────────────┤
│  WhatsApp  │ Nome │ Campanha │ Plataforma │ Data │ Ações   │
│  ...       │      │          │            │      │         │
└─────────────────────────────────────────────────────────────┘
```

Alterações:
1. Importar `useCampanhasOptions` 
2. Adicionar estado `selectedCampaign`
3. Renderizar Select com opções: "Todas as campanhas" + lista de campanhas
4. Passar `campaignId` para o hook `useCampanhasLeadsList`

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `useCampanhasLeadsList.ts` | Corrigir query SQL e adicionar filtro por campanha |
| `useCampanhasOptions.ts` | **NOVO** - Hook para listar campanhas disponíveis |
| `CampanhasLeadsTab.tsx` | Adicionar Select de sub-filtro por campanha |

---

## Fluxo de Dados Final

```text
1. Usuário seleciona período e agentes (filtros globais)
2. useCampanhasOptions carrega lista de campanhas do período
3. Usuário pode selecionar campanha específica no sub-filtro
4. useCampanhasLeadsList busca leads filtrando pela campanha selecionada
5. Tabela exibe leads com nome do contato vindo do CRM
```

---

## Visual Final

```text
┌─────────────────────────────────────────────────────────────┐
│  Campanhas Ads                                              │
│  [Dashboard] [Campanhas] [Leads]                            │
├─────────────────────────────────────────────────────────────┤
│  Leads de Campanhas                           (150 leads)   │
├─────────────────────────────────────────────────────────────┤
│  🔍 Buscar...              [Campanha: Todas as campanhas ▼] │
│                            ├─ Todas as campanhas            │
│                            ├─ Campanha X (85 leads)         │
│                            ├─ Campanha Y (42 leads)         │
│                            └─ Campanha Z (23 leads)         │
├─────────────────────────────────────────────────────────────┤
│  WhatsApp        │ Nome      │ Campanha  │ Plataforma │ ... │
│  +55 11 99999    │ João Silva│ Campanha X│ 🔵 FB      │ 💬📋│
│  +55 21 88888    │ Maria P.  │ Campanha Y│ 🟣 IG      │ 💬📋│
└─────────────────────────────────────────────────────────────┘
```

---

## Considerações Técnicas

1. **Performance**: A busca do nome via CRM adiciona um JOIN extra, mas é necessário já que `sessions` não tem essa coluna
2. **Leads sem CRM**: Leads que ainda não entraram no CRM aparecerão com "Sem nome"
3. **Sub-filtro local vs servidor**: O filtro por campanha será aplicado no servidor (via query) para melhor performance em volumes grandes
4. **Compatibilidade**: A interface `CampaignLeadItem` já está correta, apenas a query precisa de ajuste
