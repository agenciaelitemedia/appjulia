---
name: Agent Automation Flags
description: Flags por client_id em chat_client_settings que controlam transcrição automática e resumos
type: feature
---

Flags booleanas armazenadas por **client_id** em `chat_client_settings.settings` (JSONB, Supabase nativo). Chaves snake_case:

- `auto_transcribe_audio`: transcreve áudios recebidos/enviados via `chat-transcribe-audio` (fire-and-forget no webhook). Default `false`.
- `auto_summary_on_resolve`: ao resolver manualmente, dispara `chat-ai-assist incremental_summary` (nota interna `📋 Resumo automático (resolvida)`). Default `false`.
- `auto_summary_on_close`: idem para encerramento manual. **Bulk close NÃO dispara resumo** por design.

`USING_AUDIO` permanece em `agents.settings` (escopo de agente).

Gating server-side: `fetchClientAutomationFlags(clientId)` em `supabase/functions/_shared/agentSettings.ts` lê `chat_client_settings.settings` via REST (cache 60s). Consumidores:
- `chat-ai-assist` → consulta `chat_conversations.client_id` para `isAutoSummaryAllowed`.
- `uazapi-chat-webhook` → usa `queue.client_id` para auto-transcribe.

Frontend: hook `useClientAutomationFlags` lê direto de `chat_client_settings` (cache 5min). Aba "Resumos" em `ContactDetailPanel` aparece **apenas** se `auto_summary_on_resolve` OR `auto_summary_on_close` for true.

UI de configuração: `/admin/chat` → aba **"Inteligência de Atendimento"** (`InteligenciaAtendimentoTab.tsx`). Removida do wizard de agente.