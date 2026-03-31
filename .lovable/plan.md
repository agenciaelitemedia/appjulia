

# Adapter UaZapi Server-Side + Envio Direto nas Edge Functions

## Resumo

Substituir o envio via N8N por chamadas diretas à API UaZapi usando as credenciais (`evo_url`, `evo_apikey`) do agente armazenadas na tabela externa `agents`. Criar um módulo adaptador reutilizável para as Edge Functions.

## Arquivos

### 1. Criar `supabase/functions/_shared/uazapi-adapter.ts`

Módulo reutilizável (importado pelas Edge Functions) com:

```typescript
class UaZapiAdapter {
  constructor(baseUrl: string, token: string)
  
  // Mensagens
  sendText(number: string, text: string): Promise<SendResult>
  sendMedia(number: string, mediaUrl: string, caption?: string, type?: string): Promise<SendResult>
  sendLocation(number: string, lat: number, lng: number, name?: string): Promise<SendResult>
  sendContact(number: string, contact: {name: string, phone: string}): Promise<SendResult>
  sendMenu(number: string, text: string, buttons: any[]): Promise<SendResult>
  
  // Instância
  getStatus(): Promise<InstanceStatus>
  
  // Chat
  checkNumbers(numbers: string[]): Promise<CheckResult[]>
}
```

- Autenticação via header `token`
- Retry com backoff (2 tentativas)
- Logging de request/response para debug
- Formato: `POST {baseUrl}/send/text` com body `{ number, text }`

### 2. Criar `supabase/functions/_shared/get-agent-credentials.ts`

Função helper que busca `evo_url` e `evo_apikey` do agente no banco externo:

```typescript
async function getAgentCredentials(sql, codAgent: string): Promise<{evo_url: string, evo_apikey: string} | null>
```

- Query: `SELECT evo_url, evo_apikey FROM agents WHERE cod_agent = $1 AND hub = 'uazapi'`
- Retorna null se agente não tem credenciais

### 3. Editar `supabase/functions/contract-notifications-cron/index.ts`

- Remover referência a `N8N_HUB_SEND_URL`
- Importar `UaZapiAdapter` e `getAgentCredentials`
- No loop por agente, buscar credenciais e instanciar adapter
- Substituir `sendWhatsApp()` por `adapter.sendText(phone, message)`
- Se agente sem credenciais, logar e pular

### 4. Editar `supabase/functions/contract-notifications-queue/index.ts`

- Mesmo padrão: buscar credenciais do agente e incluir info de conexão na resposta da fila

## Fluxo de envio atualizado

```text
cron trigger
  → busca configs ativas (Supabase)
  → agrupa por agente
  → para cada agente:
      → busca evo_url + evo_apikey da tabela agents (DB externo)
      → instancia UaZapiAdapter(evo_url, evo_apikey)
      → busca contratos (DB externo)
      → para cada contrato elegível:
          → adapter.sendText(phone, message)
          → registra log no Supabase
```

## Benefícios

- Elimina dependência do N8N para envio
- Envio direto pela instância conectada do agente
- Adapter reutilizável para qualquer funcionalidade futura que precise enviar mensagem
- Logging detalhado da resposta real da API UaZapi

