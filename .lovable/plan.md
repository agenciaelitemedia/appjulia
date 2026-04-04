
# Por que mensagens não chegam no Chat — Diagnóstico e Correção

## Problema Raiz

O `meta-webhook` recebe mensagens da Meta corretamente (confirmado: "teste mensagem" chegou às 21:17 de hoje), mas **só grava em `webhook_logs` e `webhook_queue`**. As tabelas `chat_contacts` e `chat_messages` estão **completamente vazias** — nenhuma bridge existe entre o webhook e o chat.

Além disso:
- O webhook **não resolve `cod_agent`** a partir do `phone_number_id` — os registros recentes têm `phone_number_id=667282786474815` e `waba_id=1597096084294505` mas `cod_agent=NULL`
- O `waba-send` não tem action `send_media` — só `send_text` e `download_media`

## Plano de Correção

### 1. Atualizar `meta-webhook` — Persistir no Chat + Resolver `cod_agent`

Após inserir em `webhook_logs`/`webhook_queue`, o webhook deve:

1. **Resolver `cod_agent`**: consultar o banco externo via `db-query` para encontrar o agente pelo `waba_number_id` (= `phone_number_id` do webhook)
2. **Upsert em `chat_contacts`**: criar/atualizar contato usando `phone + client_id` (o `client_id` será buscado junto com o `cod_agent` da tabela `agents` → `user_agents`)
3. **Insert em `chat_messages`**: persistir a mensagem com `contact_id`, `external_id`, `text`, `type`, `media_url` etc.
4. **Atualizar `cod_agent`** no `webhook_logs` para rastreabilidade

### 2. Adicionar action `send_media` ao `waba-send`

O frontend já chama `waba-send` com `action: 'send_media'`, mas o edge function retorna "Unknown action". Implementar:
- Upload de mídia para Graph API (`POST /{phone_number_id}/media`)
- Envio da mensagem com o `media_id` retornado

### 3. Corrigir mapeamento `phone_number_id` → `cod_agent` + `client_id`

Criar uma função interna no `meta-webhook` que:
- Chama `db-query` com `SELECT cod_agent, user_id FROM agents JOIN user_agents ON ... WHERE waba_number_id = $1`
- Usa `user_id` como `client_id` para filtrar corretamente no chat

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/meta-webhook/index.ts` | Resolver `cod_agent`/`client_id` via `phone_number_id`; upsert `chat_contacts`; insert `chat_messages`; atualizar `cod_agent` no log |
| `supabase/functions/waba-send/index.ts` | Adicionar action `send_media` (upload + envio via Graph API) |

## Fluxo Corrigido

```text
Meta Webhook POST
  → Extrair phone_number_id do payload
  → Chamar db-query: phone_number_id → cod_agent + user_id (client_id)
  → Upsert chat_contacts (phone, client_id, cod_agent, name)
  → Insert chat_messages (text, type, media_url, external_id, contact_id)
  → Insert webhook_logs + webhook_queue (já existente)
  → Realtime notifica frontend → mensagem aparece no chat
```
