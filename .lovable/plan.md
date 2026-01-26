
# Plano de Correção: Tabela user_agents

## Problema Identificado

O erro `column "agent_id" of relation "user_agents" does not exist` ocorre porque:

1. A tabela `user_agents` usa colunas no **plural**: `users_id` e `agents_id`
2. O código atual tenta inserir usando nomes no singular: `user_id` e `agent_id`
3. O usuário também precisa que o campo `cod_agent` seja gravado na tabela

## Arquivos a Modificar

### 1. Edge Function: `supabase/functions/db-query/index.ts`

**Ação `insert_user_agent` (linhas 501-511)**

Alterar de:
```typescript
case 'insert_user_agent': {
  const { userId, agentId } = data;
  const rows = await sql.unsafe(
    `INSERT INTO user_agents (user_id, agent_id, created_at)
     VALUES ($1, $2, now())
     RETURNING id`,
    [userId, agentId]
  );
  result = rows;
  break;
}
```

Para:
```typescript
case 'insert_user_agent': {
  const { userId, agentId, codAgent } = data;
  const rows = await sql.unsafe(
    `INSERT INTO user_agents (users_id, agents_id, cod_agent, created_at)
     VALUES ($1, $2, $3, now())
     RETURNING id`,
    [userId, agentId, codAgent]
  );
  result = rows;
  break;
}
```

### 2. Cliente: `src/lib/externalDb.ts`

**Método `insertUserAgent` (linhas 187-192)**

Alterar de:
```typescript
async insertUserAgent(userId: number, agentId: number): Promise<void> {
  await this.invoke({
    action: 'insert_user_agent',
    data: { userId, agentId },
  });
}
```

Para:
```typescript
async insertUserAgent(userId: number, agentId: number, codAgent: string): Promise<void> {
  await this.invoke({
    action: 'insert_user_agent',
    data: { userId, agentId, codAgent },
  });
}
```

### 3. Hook de Save: `src/pages/agents/hooks/useAgentSave.ts`

**Chamada do `insertUserAgent` (linha 180)**

Alterar de:
```typescript
await externalDb.insertUserAgent(createdUserId, createdAgentId);
```

Para:
```typescript
await externalDb.insertUserAgent(createdUserId, createdAgentId, data.cod_agent);
```

---

## Resumo das Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `db-query/index.ts` | Corrigir nomes de colunas para `users_id`, `agents_id` + adicionar `cod_agent` |
| `externalDb.ts` | Adicionar parametro `codAgent` ao método `insertUserAgent` |
| `useAgentSave.ts` | Passar `data.cod_agent` na chamada do método |

---

## Resultado Esperado

Apos a correção:
- A inserção na tabela `user_agents` funcionará corretamente
- O `cod_agent` será gravado junto com o vínculo usuário-agente
- O fluxo de criação de agentes será concluído com sucesso
