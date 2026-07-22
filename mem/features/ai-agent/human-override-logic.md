---
name: AI Human Override
description: Toggle da Julia sempre passa por toggleJuliaSession — desativa dispara followup-stop, ativa dispara agent_and_followup-reactive
type: feature
---

## Helper único (frontend)

`src/lib/juliaSessionControl.ts` → `toggleJuliaSession({ sessionId, active, codAgent, whatsappNumber, hubFila })`:
1. `externalDb.updateSessionStatus(sessionId, active)` (flip direto na tabela `sessions`).
2. Se `active=false` → invoca `n8n_execute-followup-stop` com `{ codAgent, sessionId: cleanPhone }`.
3. Se `active=true` → invoca `n8n_execute-agent_and_followup-reactive` com `{ codAgent, whatsappNumber: cleanPhone, hubFila }` (default `'uazapi'`).
4. Erros das edges são `console.warn` — nunca bloqueiam a UI.

Todo call site que altera `session.active` DEVE usar este helper (não chamar `externalDb.updateSessionStatus` direto).

## Call sites do toggle manual

- `src/components/chat/ChatHeader.tsx` `handleToggleSession` — switch Julia no header do chat. `hubFila` vem de `useQueueAgentLink(queueId).hub`.
- `src/pages/crm/components/SessionStatusDialog.tsx` `handleToggleStatus` — diálogo de status no CRM. `hubFila` vem de `useAgentQueueLink(codAgent).hub`.
- `src/pages/crm/components/WhatsAppMessagesDialog.tsx` `handleToggleSession` — switch Julia no popup de mensagens do CRM. `hubFila` vem de `useAgentQueueLink(codAgent).hub`.

## Fluxo Assumir/Transferir (desativação automática)

A sessão Julia do contato também é desativada quando o atendente autenticado **assume** ou **transfere manualmente** a conversa. Envio manual de mensagem/mídia NÃO desativa a Julia.

**Trigger único:** `assignConversation` em `src/contexts/WhatsAppDataContext.tsx`. Cobre:
- Botão "Assumir" (`ChatHeader.handleTakeOver`, `ConversationQuickActions.handleAssume`, `ChatInput.handleClaim`/`handleReopen`).
- TransferDialog (`ChatHeader.handleTransfer`).

**Helper interno:** `disableJuliaOnAssignOrTransfer` no mesmo arquivo (NÃO usa `toggleJuliaSession` porque também precisa sincronizar caches React Query):
1. Resolve `cod_agent` via `queue_agent_links` (primary ou primeiro).
2. Se houver sessão ativa, chama `update_session_status(active=false)`.
3. Sempre dispara `n8n_execute-followup-stop` (codAgent, sessionId=telefone limpo) para parar followups pendentes.

Webhooks/edge functions (`uazapi-chat-webhook`, `waba-send`, `meta-webhook`) NÃO desativam Julia por `fromMe` — ecos, bots, n8n e automações vêm como outbound.

Transferências automáticas via routing rules server-side (UPDATE direto em `chat_conversations`) NÃO disparam, pois não passam por `assignConversation`.

Filas sem agente IA, usuário não autenticado ou sessão inexistente → followup-stop ainda é tentado, mas update_session é no-op.

**Helper edge legado:** `supabase/functions/_shared/disableJuliaOnHumanSend.ts` mantido (não chamado hoje) para uso futuro em edge functions.