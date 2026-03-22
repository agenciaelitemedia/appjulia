

# Webhook Api4Com: Configuração automática + tratamento de todos os eventos

## Situação atual

O webhook `api4com-webhook` já existe e trata apenas `channel-hangup`. Mas:
1. Não há como **cadastrar automaticamente** a URL do webhook no painel da Api4Com via API
2. Não trata outros eventos úteis (channel-create, channel-answer, etc.)
3. O admin não vê qual URL configurar no painel da Api4Com

## Alterações

### 1. `api4com-proxy/index.ts` — nova ação `setup_webhook`

Adicionar ação que chama `PATCH /integrations` na Api4Com para registrar o webhook automaticamente:

```typescript
case 'setup_webhook': {
  const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/api4com-webhook`;
  const response = await fetch(`${baseUrl}/integrations`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      gateway: 'atende-julia',
      webhook: true,
      webhookConstraint: {
        metadata: { gateway: 'atende-julia' }
      },
      metadata: {
        webhookUrl,
        webhookVersion: 'v1.4',
        webhookTypes: ['channel-create', 'channel-answer', 'channel-hangup']
      }
    }),
  });
  result = await response.json();
  break;
}
```

### 2. `api4com-webhook/index.ts` — tratar todos os eventos

Expandir para tratar:
- **channel-create**: criar registro em `phone_call_logs` com status inicial (chamada iniciada)
- **channel-answer**: atualizar `answered_at` no registro existente
- **channel-hangup**: atualizar `ended_at`, `duration_seconds`, `hangup_cause`, `record_url`, `cost`

Lógica: sempre buscar pelo `call_id`, fazer upsert. Extrair `cod_agent` do `metadata.gateway` + lookup na tabela `phone_config` pelo domínio ou pelo metadata enviado no dial.

### 3. `ConfigTab.tsx` — botão "Configurar Webhook" + exibir URL

Na aba de Configuração do admin:
- Mostrar a URL do webhook (readonly, copiável): `https://<SUPABASE_URL>/functions/v1/api4com-webhook`
- Botão **"Configurar Webhook Automaticamente"** que chama `api4com-proxy` com `action: 'setup_webhook'`
- Instruções: "Cole esta URL no painel Api4Com → Integrações → Webhook, ou clique no botão para configurar automaticamente via API"

### 4. `phone_call_logs` — nova coluna `status`

Migração para adicionar coluna `status` (text, default 'initiated'):
- Valores: `initiated`, `ringing`, `answered`, `hangup`, `failed`
- Permite mostrar status em tempo real no histórico

### 5. Atualizar `useTelefoniaAdmin.ts`

Adicionar mutation `setupWebhook` que chama `api4com-proxy` com `action: 'setup_webhook'`.

## Ordem

1. Migração (coluna `status` em `phone_call_logs`)
2. Atualizar `api4com-webhook` (tratar channel-create, channel-answer, channel-hangup)
3. Atualizar `api4com-proxy` (ação `setup_webhook`)
4. Atualizar `ConfigTab.tsx` (URL + botão configurar webhook)
5. Atualizar hook admin (mutation setupWebhook)

