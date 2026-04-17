
O alerta hoje considera todos os agentes retornados por `useMyAgents` (próprios + monitorados) com `status === true`. O usuário quer que apenas agentes onde ele é **owner** (proprietários) sejam verificados.

Em `useMyAgents.ts`:
- `myAgents` = `agent_id !== null` (proprietário)
- `monitoredAgents` = `agent_id === null` (monitorado)

## Correção

Em `src/components/layout/DisconnectedAgentsAlert.tsx`, linha onde `allAgents` é montado:

**Antes:**
```ts
const allAgents = [...agentsData.myAgents, ...agentsData.monitoredAgents].filter(a => a.status === true);
```

**Depois:**
```ts
// Apenas agentes onde o usuário é owner (agent_id !== null) e ativos
const allAgents = agentsData.myAgents.filter(a => a.status === true);
```

Isso garante:
1. Agentes monitorados são ignorados.
2. Apenas agentes ativos (`status === true`) com vínculo de proprietário são verificados.
3. A função `checkAgentConnected` continua retornando `false` somente quando confirma desconexão real (UaZapi `/instance/status` ou WABA `verify_connection`), e `null` quando não há config (ignorado no filtro `connected === false`).

Nenhuma outra mudança necessária — o fluxo de exibição do popup permanece igual.

## Arquivo a editar
- `src/components/layout/DisconnectedAgentsAlert.tsx` (1 linha)
