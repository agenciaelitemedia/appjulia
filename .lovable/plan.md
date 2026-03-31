

# Arquitetura Multi-Provider: Adapter WABA + Factory de Mensageria

## Resumo

Criar um adapter para a API Oficial da Meta (WABA) com a mesma interface do `UaZapiAdapter`, e um factory (`getMessagingAdapter`) que retorna o adapter correto baseado no campo `hub` do agente. O cron e demais funções passam a usar o factory em vez de instanciar `UaZapiAdapter` diretamente.

## Arquivos

### 1. Criar `supabase/functions/_shared/waba-adapter.ts`

Adapter WABA implementando a mesma interface `SendResult`:

```typescript
class WabaAdapter {
  constructor(accessToken: string, phoneNumberId: string)
  
  sendText(number: string, text: string): Promise<SendResult>
  sendMedia(number: string, mediaUrl: string, caption?: string, type?: string): Promise<SendResult>
  sendLocation(number: string, lat: number, lng: number, name?: string): Promise<SendResult>
  sendContact(number: string, contactName: string, contactPhone: string): Promise<SendResult>
  getStatus(): Promise<InstanceStatus>
}
```

- Usa `https://graph.facebook.com/v22.0/{phoneNumberId}/messages`
- Header `Authorization: Bearer {accessToken}`
- Body segue formato Meta: `{ messaging_product: "whatsapp", to, type: "text", text: { body } }`
- Retry com backoff (2 tentativas)

### 2. Criar `supabase/functions/_shared/messaging-factory.ts`

Interface unificada + factory:

```typescript
interface MessagingAdapter {
  sendText(number: string, text: string): Promise<SendResult>
  sendMedia(...): Promise<SendResult>
}

interface AgentMessagingCredentials {
  hub: string;
  evo_url?: string;
  evo_apikey?: string;
  waba_token?: string;
  waba_number_id?: string;
}

function createMessagingAdapter(creds: AgentMessagingCredentials): MessagingAdapter
```

- Se `hub === 'uazapi'` → retorna `UaZapiAdapter`
- Se `hub === 'waba'` → retorna `WabaAdapter`
- Senão → throw error

### 3. Refatorar `supabase/functions/_shared/get-agent-credentials.ts`

- Remover filtro `hub = 'uazapi'`
- Query: `SELECT evo_url, evo_apikey, hub, waba_token, waba_number_id FROM agents WHERE cod_agent = $1 LIMIT 1`
- Retornar `AgentMessagingCredentials` com o campo `hub`

### 4. Editar `supabase/functions/contract-notifications-cron/index.ts`

- Importar `createMessagingAdapter` em vez de `UaZapiAdapter`
- Onde faz `new UaZapiAdapter(creds.evo_url, creds.evo_apikey)`, trocar por `createMessagingAdapter(creds)`
- O resto do código (chamadas a `adapter.sendText()`) permanece idêntico

### 5. Editar `supabase/functions/contract-notifications-queue/index.ts`

- Mesmo padrão: usar factory para determinar status de conexão

## Fluxo

```text
cron → busca configs ativas
  → para cada agente:
      → getAgentCredentials(sql, codAgent)
        → retorna { hub, evo_url, evo_apikey, waba_token, waba_number_id }
      → createMessagingAdapter(creds)
        → hub === 'uazapi' → UaZapiAdapter
        → hub === 'waba'   → WabaAdapter
      → adapter.sendText(phone, message)  ← mesma interface
```

## Extensibilidade

Para adicionar um novo provider no futuro (ex: Evolution V2), basta criar o adapter e adicionar um `case` no factory.

