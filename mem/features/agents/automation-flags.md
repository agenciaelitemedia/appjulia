---
name: Agent Automation Flags
description: Flags em agents.settings que controlam transcrição automática e resumos pós-status
type: feature
---

Flags booleanas em `agents.settings` (JSONB no DB externo) consumidas via `getAgentAutomationFlags()` (`src/lib/agentSettings.ts` e `supabase/functions/_shared/agentSettings.ts`):

- `AUTO_TRANSCRIBE_AUDIO`: transcreve áudios recebidos e enviados via `chat-transcribe-audio` (fire-and-forget no webhook). Default `false`.
- `AUTO_SUMMARY_ON_RESOLVE`: ao resolver manualmente, dispara `chat-ai-assist incremental_summary` que insere nota interna `📋 Resumo automático (resolvida)`. Default `false`.
- `AUTO_SUMMARY_ON_CLOSE`: idem para encerramento manual. **Bulk close NÃO dispara resumo** por design.
- `USING_AUDIO`: pré-existente; gate geral para envio/recebimento de áudios.

Gating é sempre server-side e por **client_id** (não por fila): se ANY agente do mesmo `client_id` da conversa/fila tem a flag ativa, dispara. Frontend só chama; servidor decide via `isAutoSummaryAllowed()` em `chat-ai-assist` (consulta `chat_conversations.client_id`) e via auto-transcribe em `uazapi-chat-webhook` (usa `queue.client_id`). Resolver consolidado: `fetchClientAutomationFlags(clientId)` em `_shared/agentSettings.ts` (cache 60s, OR lógico entre todos os agents do client). Edge function `client-automation-flags` expõe ao frontend; hook `useClientAutomationFlags` cacheia 5min.

UI: card "Inteligência de Atendimento" em `ConfigStep.tsx`, abaixo de "Áudio e Ligações". Aba "Resumos" em `ContactDetailPanel` aparece **apenas** se `AUTO_SUMMARY_ON_RESOLVE` OR `AUTO_SUMMARY_ON_CLOSE` for true para o client logado.