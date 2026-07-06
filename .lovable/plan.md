## Diagnóstico

Usuário: `advlimaealbuquerque@gmail.com` — fila **TESTE API** (client_id 400)
- `waba_id`: 1062909349731148
- `waba_number_id`: 1237858579405750 (número 5521991007071)
- `waba_token`: presente (476 chars)

**Verificações feitas:**
- `queues`: credenciais WABA salvas corretamente e `is_active=true`.
- `webhook_logs`: **zero registros** para `phone_number_id=1237858579405750`. O último webhook Meta recebido em toda a plataforma foi em **junho/2026** e era de outro WABA. A Meta nunca chamou nosso webhook para essa conta.
- Código: `WabaEmbeddedSignupButton` (fluxo por fila em `QueueWizardDialog`) chama apenas `waba-admin/exchange_token` e salva o token. **Nunca chama `subscribed_apps`** para vincular o app da Meta à WABA. Apenas o antigo caminho por agente (`save_credentials`) faz esse auto-subscribe.

**Causa raiz:** a WABA foi conectada via fila, e por isso o app da Meta **não foi inscrito** (`POST /{waba_id}/subscribed_apps`). Sem essa inscrição a Meta não envia webhooks para nós, mesmo com o número "conectado" e token válido. Por isso a mensagem de 5534988860163 para 5521991007071 não chegou.

## Correção

Todas as chamadas Graph API novas usarão **v25.0** (o restante do código continua na versão atual até migração futura).

### 1. Reinscrição imediata da fila TESTE API
Nova action em `waba-admin`: `subscribe_queue` (recebe `queueId`).
- Busca `waba_id` + `waba_token` da fila no Supabase.
- `POST https://graph.facebook.com/v25.0/{waba_id}/subscribed_apps` com Bearer do token.
- `GET https://graph.facebook.com/v25.0/{waba_id}/subscribed_apps` para confirmar e retornar apps inscritos.
- Também registra callback no app: `POST https://graph.facebook.com/v25.0/{META_APP_ID}/subscriptions` com `object=whatsapp_business_account`, `fields=['messages']`, `callback_url=SUPABASE_URL/functions/v1/meta-webhook`, `verify_token=META_WEBHOOK_VERIFY_TOKEN` (idempotente).
- Invocamos com `queueId='72debbfa-c59c-4792-a2b2-dea762273111'` para consertar a conta agora.

### 2. Prevenção — auto-subscribe ao conectar por fila
No `QueueWizardDialog` (logo após criar/atualizar fila WABA com token): chamar `waba-admin/subscribe_queue` com o `queueId`. Toda nova fila WABA passa a receber webhooks automaticamente.

### 3. Botão "Reinscrever webhook Meta" na fila
Em `QueueCard` (quando `channel_type='waba'` e `waba_token`), item no menu chamando a mesma action. Serve para consertar filas WABA antigas sem recriar.

### 4. Validação
Após rodar (1), reenviar de 5534988860163 para 5521991007071 e conferir:
- `SELECT * FROM webhook_logs WHERE phone_number_id='1237858579405750' ORDER BY created_at DESC` — deve aparecer o evento.
- Mensagem visível no chat da fila TESTE API.

## Fora de escopo
- Não alteramos o fluxo por agente (`save_credentials`) que já faz auto-subscribe.
- Não mexemos em `meta-webhook`.
- Não migramos as chamadas existentes de `v22.0` — apenas o código novo usa `v25.0`.
