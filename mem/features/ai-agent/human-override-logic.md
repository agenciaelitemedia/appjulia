---
name: AI Human Override
description: Desativa sessão Julia automaticamente quando atendente humano envia mensagem (fromMe via UaZapi ou outbound via WABA)
type: feature
---

Sempre que uma mensagem `from_me=true` é persistida para um contato direto (não grupo), o sistema desativa a sessão Julia desse contato.

**Pontos de entrada:**
- `supabase/functions/uazapi-chat-webhook/index.ts` — após insert em `chat_messages`, dispara `disableJuliaOnHumanSend` quando `fromMe && !isGroup`.
- `supabase/functions/waba-send/index.ts` — após `persistOutbound`, dispara o mesmo helper.

**Helper:** `supabase/functions/_shared/disableJuliaOnHumanSend.ts`
1. Resolve `cod_agent` via `queue_agent_links.queue_id = queueId`.
2. Chama `db-query` action `get_session_status` (whatsappNumber, codAgent).
3. Se `active=true`, chama `update_session_status` com `active=false`.

Filas sem agente IA (`queue_agent_links` ausente) ou sessões inexistentes → no-op silencioso.
Mensagens com `metadata.source in ('bot','campaign','autoreply','ai')` são ignoradas pelo helper.
Execução é fire-and-forget via `EdgeRuntime.waitUntil`.