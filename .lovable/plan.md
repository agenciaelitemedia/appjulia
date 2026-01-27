
## Plano: Corrigir Endpoints da API UaZapi

### Problema
A Edge Function está usando endpoints incorretos que retornam HTTP 405 (Method Not Allowed).

### Correções Necessárias

**Arquivo**: `supabase/functions/uazapi-admin/index.ts`

#### 1. Corrigir endpoint de criação de instância
**Linha 109** - Trocar:
```typescript
// De:
const createResponse = await fetch(`${UAZAPI_BASE_URL}/admin/instance`, {
// Para:
const createResponse = await fetch(`${UAZAPI_BASE_URL}/instance/init`, {
```

#### 2. Corrigir endpoint de webhook
**Linha 143** - Trocar:
```typescript
// De:
const webhookResponse = await fetch(`${UAZAPI_BASE_URL}/webhook/set`, {
// Para:
const webhookResponse = await fetch(`${UAZAPI_BASE_URL}/webhook`, {
```

#### 3. Corrigir configuração de eventos do webhook
**Linhas 149-156** - Trocar:
```typescript
// De:
body: JSON.stringify({
  url: webhookUrl,
  events: ['messages.upsert'],
  webhook_by_events: false,
  ignore_groups: true,
  ignore_status: true,
  ignore_broadcast: true,
}),

// Para (conforme documentação):
body: JSON.stringify({
  url: webhookUrl,
  enabled: true,
  events: ['messages'],
  excludeMessages: ['wasSentByApi', 'isGroupYes'],
}),
```

### Resumo das Mudanças

| Item | Antes | Depois |
|------|-------|--------|
| Endpoint criar instância | `/admin/instance` | `/instance/init` |
| Endpoint webhook | `/webhook/set` | `/webhook` |
| Eventos | `['messages.upsert']` | `['messages']` |
| Filtros | `ignore_groups: true` | `excludeMessages: ['wasSentByApi', 'isGroupYes']` |
| Campo enabled | não existia | `enabled: true` |

### Fluxo Corrigido

```text
1. POST /instance/init
   Headers: { admintoken: UAZAPI_ADMIN_TOKEN }
   Body: { name: "[JulIAv2][202601003] - Cliente" }
   Response: { token: "abc123...", name: "..." }

2. POST /webhook
   Headers: { token: "abc123..." }
   Body: {
     url: "https://webhook.../webhook/julia_MQv8.2_start?app=uazapi&c=202601003",
     enabled: true,
     events: ["messages"],
     excludeMessages: ["wasSentByApi", "isGroupYes"]
   }

3. UPDATE agents SET hub='uazapi', evo_url='...', evo_apikey='...', evo_instancia='...'
```

### Arquivo a Modificar

| Arquivo | Alterações |
|---------|------------|
| `supabase/functions/uazapi-admin/index.ts` | Corrigir 3 pontos: endpoint init, endpoint webhook, e body do webhook |

Após a correção, a função será reimplantada automaticamente.
