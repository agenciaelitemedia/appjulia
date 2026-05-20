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

Gating é sempre server-side: se ANY agente vinculado à fila tem a flag ativa, dispara. Frontend só chama; servidor decide via `isAutoSummaryAllowed()` em `chat-ai-assist`.

UI: card "Inteligência de Atendimento" em `ConfigStep.tsx`, abaixo de "Áudio e Ligações".