---
name: AI Human Override
description: Desativa sessão Julia + dispara followup-stop somente em Assumir/Transferir manual no chat
type: feature
---

A sessão Julia do contato só é desativada quando o atendente autenticado **assume** ou **transfere manualmente** a conversa. Envio manual de mensagem/mídia NÃO desativa mais a Julia.

**Trigger único:** `assignConversation` em `src/contexts/WhatsAppDataContext.tsx`. Cobre:
- Botão "Assumir" (`ChatHeader.handleTakeOver`, `ConversationQuickActions.handleAssume`, `ChatInput.handleClaim`/`handleReopen`).
- TransferDialog (`ChatHeader.handleTransfer`).

**Helper interno:** `disableJuliaOnAssignOrTransfer` no mesmo arquivo:
1. Resolve `cod_agent` via `queue_agent_links` (primary ou primeiro).
2. Se houver sessão ativa, chama `update_session_status(active=false)`.
3. Sempre dispara `n8n_execute-followup-stop` (codAgent, sessionId=telefone limpo) para parar followups pendentes.

Webhooks/edge functions (`uazapi-chat-webhook`, `waba-send`, `meta-webhook`) NÃO desativam Julia por `fromMe` — ecos, bots, n8n e automações vêm como outbound.

Transferências automáticas via routing rules server-side (UPDATE direto em `chat_conversations`) NÃO disparam, pois não passam por `assignConversation`.

Filas sem agente IA, usuário não autenticado ou sessão inexistente → followup-stop ainda é tentado, mas update_session é no-op.

**Helper edge legado:** `supabase/functions/_shared/disableJuliaOnHumanSend.ts` mantido (não chamado hoje) para uso futuro em edge functions.