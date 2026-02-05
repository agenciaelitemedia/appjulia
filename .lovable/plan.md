
# Plano: Integração Meta Marketing API para Campanhas Ads

## Visão Geral

Criar uma página de teste/demo para integrar com a **Meta Marketing API** (Facebook/Instagram Ads), permitindo:
1. **Autenticar** com OAuth e obter token de acesso
2. **Buscar campanhas e anúncios** do Ads Manager
3. **Retroalimentar o Pixel** (Conversions API) com eventos de conversão do CRM
4. **Sincronizar dados** para enriquecer a tabela `campaing_ads`

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│  /admin/meta-ads-test                                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐│
│  │ OAuth Flow  │ │ Listar Ads  │ │ Insights    │ │ Conversions││
│  │ (Login FB)  │ │ Campanhas   │ │ por Campanha│ │ API Test   ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘│
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Edge Functions                                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ meta-auth    │  │ meta-ads     │  │ meta-conversions       │ │
│  │ (existente)  │  │ (novo)       │  │ (novo)                 │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Meta Graph API                                │
│  • Marketing API v24.0                                          │
│  • Insights API                                                  │
│  • Conversions API                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Funcionalidades da Página Demo

### 1. Autenticação OAuth (Reutilizando `meta-auth`)
- Login com Facebook
- Seleção de Ad Account
- Obtenção de token com permissões `ads_read`, `ads_management`

### 2. Listagem de Campanhas
- Buscar campanhas ativas do Ad Account
- Exibir: nome, status, objetivo, orçamento
- Filtrar por status (ACTIVE, PAUSED, etc)

### 3. Insights de Campanhas
- Métricas: impressões, cliques, CTR, CPM, CPC, gastos
- Breakdown por período
- Visualização comparativa

### 4. Conversions API (Retroalimentação do Pixel)
- Enviar eventos de conversão do CRM
- Tipos: Lead, ViewContent, Purchase
- Mapear leads qualificados → eventos Meta

## Detalhes Técnicos

### Nova Edge Function: `meta-ads`

Ações disponíveis:
- `get_ad_accounts` - Listar contas de anúncios do usuário
- `get_campaigns` - Listar campanhas de uma conta
- `get_adsets` - Listar conjuntos de anúncios
- `get_ads` - Listar anúncios individuais
- `get_insights` - Obter métricas de performance

```typescript
// Exemplo de chamada para obter campanhas
GET /act_{AD_ACCOUNT_ID}/campaigns
  ?fields=name,status,objective,daily_budget,lifetime_budget,start_time,stop_time
  &effective_status=["ACTIVE","PAUSED"]
  &access_token={TOKEN}
```

### Nova Edge Function: `meta-conversions`

Enviar eventos para o Pixel via Conversions API:
- `send_lead_event` - Quando lead é qualificado
- `send_purchase_event` - Quando contrato é assinado

```typescript
// Exemplo de payload para Conversions API
POST /{PIXEL_ID}/events
{
  "data": [{
    "event_name": "Lead",
    "event_time": 1643723400,
    "action_source": "website",
    "user_data": {
      "em": ["hashed_email"],
      "ph": ["hashed_phone"]
    },
    "custom_data": {
      "lead_source": "whatsapp",
      "campaign_id": "123456"
    }
  }]
}
```

### Componentes da Página Demo

| Componente | Descrição |
|------------|-----------|
| `MetaAdsAuth` | Login OAuth + seleção de Ad Account |
| `MetaAdsCampaignsList` | Tabela de campanhas com filtros |
| `MetaAdsInsightsPanel` | Métricas e gráficos de performance |
| `MetaConversionsTest` | Formulário para testar envio de eventos |
| `MetaAdsSyncPreview` | Preview de dados a sincronizar com CRM |

## Secrets Necessários (Já Configurados)

| Secret | Status |
|--------|--------|
| `META_APP_ID` | Configurado |
| `META_APP_SECRET` | Configurado |

## Permissões do App Meta Necessárias

Para acessar a Marketing API, o app precisa das permissões:
- `ads_read` - Leitura de campanhas e insights
- `ads_management` - Gerenciamento de campanhas (opcional)
- `business_management` - Acesso a Business Manager

## Arquivos a Criar/Modificar

### Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/admin/meta-ads/MetaAdsTestPage.tsx` | Página principal |
| `src/pages/admin/meta-ads/types.ts` | Tipos TypeScript |
| `src/pages/admin/meta-ads/components/MetaAdsAuth.tsx` | Autenticação |
| `src/pages/admin/meta-ads/components/AdAccountSelector.tsx` | Seletor de conta |
| `src/pages/admin/meta-ads/components/CampaignsList.tsx` | Lista de campanhas |
| `src/pages/admin/meta-ads/components/InsightsPanel.tsx` | Painel de insights |
| `src/pages/admin/meta-ads/components/ConversionsTest.tsx` | Teste de conversões |
| `src/pages/admin/meta-ads/hooks/useMetaAds.ts` | Hook de dados |
| `supabase/functions/meta-ads/index.ts` | Edge function para Ads |
| `supabase/functions/meta-conversions/index.ts` | Edge function para Conversions API |

### Modificações

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Adicionar rota `/admin/meta-ads` |
| `supabase/config.toml` | Registrar novas functions |

## Fluxo de Uso

```text
1. Usuário acessa /admin/meta-ads
       │
       ▼
2. Clica "Conectar com Facebook"
       │
       ▼
3. Autoriza permissões (ads_read)
       │
       ▼
4. Seleciona Ad Account
       │
       ▼
5. Visualiza campanhas e métricas
       │
       ▼
6. Testa Conversions API com lead do CRM
       │
       ▼
7. Configura sincronização automática (futuro)
```

## Próximos Passos Após Demo

1. **Sincronização Automática**: Correlacionar `sourceID` do WhatsApp com `ad_id` da Meta
2. **Retroalimentação em Tempo Real**: Webhook para enviar conversões automaticamente
3. **Dashboard Enriquecido**: Combinar dados internos com insights da Meta
4. **Otimização de Público**: Criar audiences customizadas baseadas em leads qualificados

## Estimativa de Implementação

| Fase | Descrição | Complexidade |
|------|-----------|--------------|
| 1 | Edge Functions (meta-ads, meta-conversions) | Média |
| 2 | Componentes de UI (Auth, Lista, Insights) | Média |
| 3 | Teste de Conversions API | Baixa |
| 4 | Integração com dados existentes | Alta |

---

Esta implementação criará uma base sólida para a integração completa com Meta Ads, permitindo validar o fluxo antes de automatizar a sincronização.
