

## Gravar agent_id como NULL para agentes monitorados

### Problema

O `MonitorAgentDialog` grava `agent_id` com o valor real do agente, mas o `useMyAgents` diferencia agentes proprios de monitorados verificando `agent_id === null`. Resultado: agentes monitorados aparecem como "Meus Agentes" em vez de "Agentes Monitorados".

### Alteracoes

#### 1. `src/pages/agents/components/MonitorAgentDialog.tsx`

Passar `null` como segundo argumento (agentId) na chamada `insertUserAgent`:

```typescript
await externalDb.insertUserAgent(
  selectedUser.id,
  null,                      // agent_id = NULL → monitorado
  selectedAgent.cod_agent
);
```

#### 2. `src/lib/externalDb.ts`

Alterar o tipo do parametro `agentId` para aceitar `null`:

```typescript
async insertUserAgent(userId: number, agentId: number | null, codAgent: string): Promise<void> {
```

#### 3. `supabase/functions/db-query/index.ts` (case `insert_user_agent`)

Tratar `agentId` nulo no SQL, usando `$2::int` para permitir NULL:

```typescript
case 'insert_user_agent': {
  const { userId, agentId, codAgent } = data;
  const rows = await sql.unsafe(
    `INSERT INTO user_agents (user_id, agent_id, cod_agent, created_at)
     VALUES ($1, $2::int, $3::bigint, now())
     RETURNING id`,
    [userId, agentId ?? null, codAgent]
  );
  result = rows;
  break;
}
```

### Impacto

- A chamada existente em `useAgentSave.ts` continua funcionando normalmente pois passa um `agentId` numerico real
- Apenas o `MonitorAgentDialog` passa `null`, fazendo o agente aparecer corretamente na secao "Agentes Monitorados"

### Arquivos modificados

- `src/pages/agents/components/MonitorAgentDialog.tsx` — passar null como agentId
- `src/lib/externalDb.ts` — tipo do parametro
- `supabase/functions/db-query/index.ts` — tratar NULL no SQL

