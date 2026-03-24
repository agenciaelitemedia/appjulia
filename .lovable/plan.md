# Refatorar meta-webhook: resposta imediata + fila de envio para N8N

## Problema atual

A Edge Function faz lookup no banco externo e envia ao N8N **antes** de responder 200 à Meta, causando timeouts e reenvios.

## Arquitetura proposta

```text
Meta → meta-webhook → INSERT webhook_queue → RESPONDE 200 (imediato)
                           ↓
                    processQueue() (background, fire-and-forget)
                           ↓
                    Lê pending → envia síncrono ao N8N → atualiza status
```

URL do N8N: `https://webhook.atendejulia.com.br/webhook/julia_MQv8.2_start?app=waba&waba_id={waba_id}`

## Alteracoes

### 1. Nova tabela `webhook_queue`

Campos: `id`, `waba_id`, `phone_number_id`, `from_number`, `message_id` (dedup), `message_type`, `payload` (raw completo), `contacts`, `status` (pending/sent/failed), `retries`, `created_at`, `sent_at`, `error_message`, `n8n_response_status`.

### 2. Alterar tabela `webhook_logs`

Adicionar colunas: `message_id` (WhatsApp message ID), `message_type`, `status_type` (para status updates), `waba_id`, `phone_number_id` — para gravar dados mais ricos do webhook.

### 3. Reescrever `meta-webhook/index.ts`

Fluxo no POST:

1. Parse body
2. Extrair mensagens e statuses do payload
3. INSERT em `webhook_queue` (itens com status `pending`) — sem lookup no banco externo
4. INSERT em `webhook_logs` (log completo com metadata)
5. **Responder 200 imediatamente**
6. Fire-and-forget: `processQueue()` que:
  - Para cada item pending na fila, envia síncrono ao N8N na URL `https://webhook.atendejulia.com.br/webhook/julia_MQv8.2_start?app=waba&waba_id={waba_id}`
  - Atualiza status para `sent` ou `failed`
  - Atualiza o `webhook_logs` correspondente com `forwarded=true` e `cod_agent`

Deduplicação: usa `message_id` do WhatsApp para ignorar mensagens já na fila.

### 4. Action `process_queue` (fallback)

Adicionar action para processar itens pending manualmente ou via cron, caso o fire-and-forget não complete.

## Arquivos alterados


| Arquivo                                    | O que muda                                               |
| ------------------------------------------ | -------------------------------------------------------- |
| Migração SQL                               | Cria `webhook_queue`, adiciona colunas ao `webhook_logs` |
| `supabase/functions/meta-webhook/index.ts` | Resposta imediata + fila + processamento background      |
