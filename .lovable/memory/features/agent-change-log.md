---
name: Agent Change Log
description: Versionamento de alterações de agentes com tabela agent_change_log no Supabase e coluna na listagem
type: feature
---
- Tabela `agent_change_log` (Supabase) registra create/update/status_change com snapshot, changed_by, cod_agent
- `useAgentChangeLog.ts` fornece `insertAgentChangeLog()` e `useAgentsLastChanges()` (React Query)
- `useAgentUpdate.saveChanges` aceita `codAgent` + `changedBy` opcionais (4º e 5º args)
- `useAgentSave.saveAgent` aceita `changedBy` opcional (3º arg)
- AgentsList exibe coluna "Última Alteração" com data/hora + autor, e loga status_change no toggle
