
# Plano: Aba de Leads das Campanhas

## Objetivo

Criar uma terceira aba no módulo de Campanhas chamada **"Leads"** que lista todos os leads individuais vindos de campanhas, mostrando:
- Número do WhatsApp
- De onde veio (campanha/plataforma)
- Ícone para acessar o popup da conversa (WhatsAppMessagesDialog)
- Ícone para navegar ao CRM filtrado pelo WhatsApp do lead

---

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│  CampanhasPage.tsx                                          │
│  ├── TabsTrigger "Dashboard"                                │
│  ├── TabsTrigger "Campanhas"                                │
│  └── TabsTrigger "Leads" (NOVO)                             │
│      └── CampanhasLeadsTab.tsx (NOVO)                       │
│          ├── useCampanhasLeadsList (NOVO) - hook de dados   │
│          ├── Tabela com paginação e ordenação               │
│          ├── WhatsAppMessagesDialog (existente)             │
│          └── Link para CRM com filtro                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Dados Necessários

A query buscará cada lead individual com os dados da campanha:

```sql
SELECT 
  ca.id,
  ca.cod_agent::text as cod_agent,
  ca.created_at,
  COALESCE(
    NULLIF(campaign_data->>'phone', ''),
    s.whatsapp_number::text
  ) as whatsapp,
  s.name as contact_name,
  campaign_data->>'title' as campaign_title,
  campaign_data->>'sourceID' as campaign_id,
  COALESCE(campaign_data->>'sourceApp', 'outros') as platform,
  campaign_data->>'greetingMessageBody' as greeting_message,
  COALESCE(c.name, 'Escritório') as office_name
FROM campaing_ads ca
LEFT JOIN sessions s ON s.id = ca.session_id::int
LEFT JOIN agents a ON a.cod_agent = ca.cod_agent
LEFT JOIN clients c ON c.id = a.client_id
WHERE ca.cod_agent::text = ANY($1::varchar[])
  AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2
  AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3
ORDER BY ca.created_at DESC
```

---

## Interface do Usuário

### Layout da Tabela

| WhatsApp | Nome | Campanha | Plataforma | Frase | Data | Ações |
|----------|------|----------|------------|-------|------|-------|
| +55 11 99999-9999 | João Silva | Campanha X | Facebook | "Olá..." | 01/02/26 | 💬 📋 |

- **💬** Abre o WhatsAppMessagesDialog com as mensagens do lead
- **📋** Navega para `/crm/leads?search={whatsapp}` filtrando pelo número

### Funcionalidades
- Busca local por nome, whatsapp, campanha
- Ordenação por data, campanha, plataforma
- Paginação (20 itens por página)
- Badge de plataforma colorido
- Exportar CSV (opcional)

---

## Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/estrategico/campanhas/components/CampanhasLeadsTab.tsx` | Componente da aba com tabela de leads |
| `src/pages/estrategico/campanhas/hooks/useCampanhasLeadsList.ts` | Hook para buscar leads individuais |

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/estrategico/campanhas/types.ts` | Adicionar interface `CampaignLeadItem` |
| `src/pages/estrategico/campanhas/CampanhasPage.tsx` | Adicionar nova aba "Leads" |

---

## Nova Interface TypeScript

```typescript
// types.ts
export interface CampaignLeadItem {
  id: string;
  cod_agent: string;
  office_name: string;
  whatsapp: string;
  contact_name: string;
  campaign_id: string;
  campaign_title: string;
  platform: string;
  greeting_message: string;
  created_at: string;
}
```

---

## Detalhes da Implementação

### 1. Hook useCampanhasLeadsList

```typescript
export function useCampanhasLeadsList(filters: CampanhasFiltersState) {
  return useQuery({
    queryKey: ['campanhas-leads-list', filters],
    queryFn: async () => {
      // Query SQL acima
    },
    enabled: filters.agentCodes.length > 0,
  });
}
```

### 2. Componente CampanhasLeadsTab

- Recebe `filters` como prop
- Usa o hook para buscar dados
- Renderiza tabela com colunas definidas
- Estado para controlar o dialog de mensagens
- Navegação para CRM usando `useNavigate`

### 3. Integração com CRM

O botão de "ir para CRM" usará:
```typescript
const navigate = useNavigate();
navigate(`/crm/leads?search=${encodeURIComponent(lead.whatsapp)}`);
```

O CRMPage já suporta busca via URL params através do `UnifiedFilters`.

---

## Visual Final

```text
┌─────────────────────────────────────────────────────────────┐
│  Campanhas Ads                                              │
│  [Dashboard] [Campanhas] [Leads] ← NOVA ABA                 │
├─────────────────────────────────────────────────────────────┤
│  🔍 Buscar leads...                    [Ordenar ▼]          │
├─────────────────────────────────────────────────────────────┤
│  WhatsApp        │ Nome    │ Campanha    │ Plataforma │ ... │
│──────────────────┼─────────┼─────────────┼────────────┼─────│
│ +55 11 99999-9999│ João S. │ Campanha X  │ 🔵 FB      │ 💬📋│
│ +55 21 88888-8888│ Maria P.│ Campanha Y  │ 🟣 IG      │ 💬📋│
│ ...              │         │             │            │     │
├─────────────────────────────────────────────────────────────┤
│  ◀ Anterior     Página 1 de 15           Próxima ▶          │
└─────────────────────────────────────────────────────────────┘
```

---

## Considerações Técnicas

1. **Performance**: Query pode retornar muitos registros; paginação do lado do cliente é aceitável para volumes moderados
2. **WhatsApp nulo**: Alguns leads podem não ter WhatsApp - serão exibidos com "-" e os botões de ação desabilitados
3. **Reuso**: Usa o mesmo `WhatsAppMessagesDialog` já existente no sistema
4. **Navegação CRM**: O parâmetro de busca na URL será lido pelo `UnifiedFilters` do CRM
