

## Objetivo

Criar o secret `N8N_HUB_WEBHOOK_URL` = `https://webhook.atendejulia.com.br/webhook/julia_MQv8.2_start` e apontar os webhooks de chat (UaZapi + WABA) para ele, **enviando apenas em eventos de mensagem nova recebida** (não status, não delete, não update).

## Regra de fan-out por canal

| Canal | Quando dispara (APENAS) | Quando NÃO dispara | URL alvo |
|---|---|---|---|
| UaZapi | `messages.upsert` (alias: `messages`, `message`) | `messages.update`, `messages.delete`, `chats.update`, `contacts.update`, `connection.update`, qualquer outro | `${N8N_HUB_WEBHOOK_URL}?app=uazapi&c=<cod_agent>` |
| WABA | `change.field === 'messages'` E item dentro de `value.messages[]` (mensagem nova recebida) | `value.statuses[]` (sent/delivered/read/failed), demais `field` (`account_update`, `message_template_status_update` etc.) | `${N8N_HUB_WEBHOOK_URL}?app=waba&waba_id=<entry.id>&c=<cod_agent>` |

Em ambos: um POST por `cod_agent` vinculado à fila, body = payload bruto recebido do provedor, `Content-Type: application/json`.

## Mudanças

### 1. Novo secret
- Criar `N8N_HUB_WEBHOOK_URL` = `https://webhook.atendejulia.com.br/webhook/julia_MQv8.2_start`.
- `N8N_HUB_SEND_URL` permanece (fluxo legado `/advbox-send` em `processQueue`), mas os blocos novos de fan-out de chat deixam de lê-lo.

### 2. `supabase/functions/uazapi-chat-webhook/index.ts`
- Substituir, no bloco de fan-out já existente, `Deno.env.get('N8N_HUB_SEND_URL')` por `Deno.env.get('N8N_HUB_WEBHOOK_URL')`.
- Manter o gate `if (isMessageUpsert)` — fan-out só roda para mensagem nova; demais eventos retornam sem disparar.
- Mantém `?app=uazapi&c=<cod_agent>`, body cru, e logs `[fan-out] POST n8n agent=... url=...` / `[fan-out] response agent=... status=...`.

### 3. `supabase/functions/meta-webhook/index.ts` (WABA)
- Adicionar fan-out novo, **independente** do `processQueue` legado.
- Iterar `body.entry[].changes[]`:
  - Ignorar quando `change.field !== 'messages'`.
  - Ignorar `value.statuses[]` (não dispara nada para n8n).
  - Para cada item em `value.messages[]` (mensagem recebida): resolver `phone_number_id` → `queue` → `queue_agent_links`. Para cada `cod_agent`:
    - `POST ${N8N_HUB_WEBHOOK_URL}?app=waba&waba_id=<entry.id>&c=<cod_agent>`
    - body: o **payload original completo** recebido da Meta (`req.json()` cru), `Content-Type: application/json`.
- Coletar todas as promises e aguardar com `Promise.allSettled` **antes** do `return` (Supabase mata o isolate ao responder).
- Logs: `[fan-out waba] event=messages waba_id=<id> queue=<id> targets=<n>` / `[fan-out waba] response agent=<cod> status=<http>`.
- Não tocar em `webhook_queue` / `processQueue` (continua como está, fluxo legado).

### 4. Build error pré-existente
O erro de build em `_shared/resolve-queue.ts` (cert CA store) não é causado por este plano. Deploy será feito por função (`uazapi-chat-webhook`, `meta-webhook`) via CLI, contornando o build agregado, como já foi feito antes.

### 5. Deploy
Deploy automático de `uazapi-chat-webhook` e `meta-webhook`.

## Validação

1. UaZapi `messages.upsert` → log `POST .../julia_MQv8.2_start?app=uazapi&c=<cod>` + `status=200`.
2. UaZapi `messages.update` (status delivered/read) → **nenhum** POST para `julia_MQv8.2_start`.
3. WABA `value.messages[]` → log `POST .../julia_MQv8.2_start?app=waba&waba_id=<id>&c=<cod>` + `status=200`.
4. WABA `value.statuses[]` (delivered/read) → **nenhum** POST para `julia_MQv8.2_start`.
5. No n8n conferir execuções nos dois `app` com body cru do provedor.

## Arquivos previstos

- `supabase/functions/uazapi-chat-webhook/index.ts`
- `supabase/functions/meta-webhook/index.ts`
- Novo secret `N8N_HUB_WEBHOOK_URL`

