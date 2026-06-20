---
name: AI Human Override
description: Desativa sessão Julia somente quando usuário autenticado envia mensagem manual no chat
type: feature
---

Somente envio manual feito por usuário autenticado no chat deve desativar a sessão Julia do contato.

**Pontos de entrada:**
- `src/contexts/WhatsAppDataContext.tsx` — após envio manual de texto/mídia pelo usuário, verifica `queue_agent_links`; se existir IA vinculada e a sessão estiver ativa, chama `update_session_status(active=false)`.
- Webhooks/edge functions (`uazapi-chat-webhook`, `waba-send`) não devem desativar Julia por `fromMe`, pois ecos, automações e n8n também chegam como outbound.

**Helper:** `supabase/functions/_shared/disableJuliaOnHumanSend.ts`
1. Resolve `cod_agent` via `queue_agent_links.queue_id = queueId`.
2. Chama `db-query` action `get_session_status` (whatsappNumber, codAgent).
3. Se `active=true`, chama `update_session_status` com `active=false`.

Filas sem agente IA (`queue_agent_links` ausente), usuário ausente ou sessões inexistentes → no-op silencioso.
Mensagens enviadas por n8n, bot, campanha, autoreply, webhook ou qualquer integração server-side não podem parar a Julia.