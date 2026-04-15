

## Plano: Adicionar `user_id` na tabela `agents` e remover filtro por role

### Problema atual
O dono do agente é determinado via JOIN com `user_agents` + filtro `u.role = 'user'`, o que é frágil e pode retornar o usuário errado (como aconteceu com Kaio vs Marcia).

### Solução
Adicionar coluna `user_id` diretamente na tabela `agents` do banco externo, preenchê-la para os 21 agentes existentes, e usar essa coluna como fonte de verdade para o proprietário.

---

### Etapa 1 — Adicionar coluna `user_id` na tabela `agents` (banco externo)

Executar via `db-query` action `raw`:
```sql
ALTER TABLE agents ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
```

### Etapa 2 — Popular `user_id` para os 21 agentes existentes

Executar via `db-query` action `raw`:
```sql
UPDATE agents a
SET user_id = (
  SELECT ua.user_id 
  FROM user_agents ua 
  JOIN users u ON u.id = ua.user_id AND u.role = 'user'
  WHERE ua.agent_id = a.id
  LIMIT 1
)
WHERE a.user_id IS NULL;
```

### Etapa 3 — Atualizar `insert_agent` para receber `user_id`

**Arquivo: `supabase/functions/db-query/index.ts`** — case `insert_agent` (~linha 706)

- Adicionar `user_id` no destructuring e no INSERT SQL

### Etapa 4 — Atualizar `insert_user_agent` para setar `user_id` no agent

**Arquivo: `supabase/functions/db-query/index.ts`** — case `insert_user_agent` (~linha 727)

- Quando `agentId` não é null (vínculo de proprietário), também executar:
  ```sql
  UPDATE agents SET user_id = $1 WHERE id = $2
  ```

### Etapa 5 — Simplificar `get_agent_details`

**Arquivo: `supabase/functions/db-query/index.ts`** — case `get_agent_details` (~linha 800)

Remover o `LEFT JOIN LATERAL` e o filtro `u.role = 'user'`. Substituir por:
```sql
LEFT JOIN users u ON u.id = a.user_id
LEFT JOIN user_agents ua ON ua.agent_id = a.id AND ua.user_id = a.user_id
```

### Etapa 6 — Atualizar `meta-webhook` resolveAgent

**Arquivo: `supabase/functions/meta-webhook/index.ts`** (~linha 24)

Alterar de:
```sql
SELECT a.cod_agent, ua.user_id FROM agents a JOIN user_agents ua ...
```
Para:
```sql
SELECT a.cod_agent, a.user_id FROM agents a WHERE a.waba_number_id = $1 LIMIT 1
```

### Etapa 7 — Atualizar `useAgentSave` para passar `user_id`

**Arquivo: `src/lib/externalDb.ts`** — método `insertAgent`

- Adicionar `user_id` ao payload enviado para `insert_agent`

**Arquivo: `src/pages/agents/hooks/useAgentSave.ts`** (~linha 144)

- Incluir `user_id: createdUserId` no `agentData`

### Etapa 8 — Deploy das Edge Functions

- Redeploiar `db-query` e `meta-webhook`

---

### Resumo de arquivos alterados
1. `supabase/functions/db-query/index.ts` — cases `insert_agent`, `insert_user_agent`, `get_agent_details`
2. `supabase/functions/meta-webhook/index.ts` — `resolveAgent`
3. `src/lib/externalDb.ts` — `insertAgent` payload
4. `src/pages/agents/hooks/useAgentSave.ts` — passar `user_id`

