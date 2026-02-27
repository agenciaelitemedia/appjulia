

## Verificar duplicidade antes de inserir monitoramento

### Alteração

#### 1. `supabase/functions/db-query/index.ts` (case `insert_user_agent`)

Antes do INSERT, fazer um SELECT para verificar se já existe um registro com o mesmo `user_id` e `cod_agent` onde `agent_id IS NULL` (monitorado). Se existir, retornar erro:

```typescript
case 'insert_user_agent': {
  const { userId, agentId, codAgent } = data;
  
  // Verificar duplicidade para monitoramento
  if (agentId === null || agentId === undefined) {
    const existing = await sql.unsafe(
      `SELECT id FROM user_agents WHERE user_id = $1 AND cod_agent = $2::text AND agent_id IS NULL LIMIT 1`,
      [userId, codAgent]
    );
    if (existing.length > 0) {
      throw new Error('duplicate: Este usuário já monitora este agente');
    }
  }
  
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

#### 2. `src/pages/agents/components/MonitorAgentDialog.tsx`

O tratamento de erro existente (linhas 96-101) já captura mensagens com "duplicate", então a mensagem de toast `'Este usuário já está vinculado a este agente'` será exibida automaticamente. Nenhuma alteração necessária no frontend.

### Arquivos modificados

- `supabase/functions/db-query/index.ts` — adicionar verificação de duplicidade antes do INSERT

