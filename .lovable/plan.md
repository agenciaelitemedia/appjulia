
## Objetivo
Garantir que a inserção e as consultas relacionadas à tabela `user_agents` usem exatamente o schema real informado por você:

- `user_id` (não `users_id`)
- `agent_id` (não `agents_id`)
- gravar também `cod_agent`

Isso elimina o erro 500: `column "agents_id" of relation "user_agents" does not exist`.

---

## O que já está correto (confirmado no diff)
A ação `insert_user_agent` no backend function já está com:
```sql
INSERT INTO user_agents (user_id, agent_id, cod_agent, created_at)
```
Então, a parte de INSERT está alinhada com seu schema.

---

## Problema que ainda falta corrigir (causa provável de continuar aparecendo “agents_id”)
No mesmo backend function (`supabase/functions/db-query/index.ts`), a action `get_agent_details` ainda faz JOIN usando colunas antigas:

Hoje está assim:
```sql
LEFT JOIN user_agents ua ON ua.agents_id = a.id
LEFT JOIN users u ON u.id = ua.users_id
```

Como sua tabela é:
- `ua.agent_id`
- `ua.user_id`

essa query pode disparar o mesmo erro `agents_id does not exist` quando a UI tenta carregar detalhes do agente (por exemplo após salvar, ao redirecionar/atualizar a tela).

---

## Mudanças a implementar

### 1) Corrigir `get_agent_details` para usar `user_id` e `agent_id`
**Arquivo:** `supabase/functions/db-query/index.ts`  
**Mudança:** trocar:
- `ua.agents_id` -> `ua.agent_id`
- `ua.users_id` -> `ua.user_id`

Ficará assim:
```sql
LEFT JOIN user_agents ua ON ua.agent_id = a.id
LEFT JOIN users u ON u.id = ua.user_id
```

Opcional (recomendado): também retornar `ua.cod_agent` no SELECT (ajuda a validar rapidamente que está sendo gravado e lido corretamente).

---

### 2) Garantir tipagem de `cod_agent` (bigint)
Você informou `cod_agent bigint`. Hoje o frontend envia como string numérica (ex: `"202601003"`), que geralmente o Postgres converte sozinho, mas para ficar 100% robusto:
- Ajustar o INSERT para forçar cast: `$3::bigint` (ou `CAST($3 AS bigint)`).

Exemplo:
```sql
VALUES ($1, $2, $3::bigint, now())
```

---

## Teste após a correção (antes de você tentar no fluxo todo)
1) Testar a chamada `insert_user_agent` isolada (com userId/agentId/codAgent válidos) e confirmar que retorna `id`.
2) Testar `get_agent_details` para um `agentId` recém-criado e verificar que não ocorre erro e que o `user_id` e `cod_agent` vêm corretamente.

Se qualquer erro persistir, vou adicionar logs explícitos no backend function para registrar:
- `action` recebido
- parâmetros (`userId`, `agentId`, `codAgent`)
- qual query falhou

---

## Arquivos envolvidos
- `supabase/functions/db-query/index.ts` (obrigatório: corrigir `get_agent_details`; opcional: cast do `cod_agent`)
- Nenhuma mudança adicional é necessária no frontend neste ajuste (o `insertUserAgent` já envia `codAgent`).

---

## Resultado esperado
Depois dessas correções:
- Nenhuma parte do sistema referencia `agents_id/users_id` na tabela `user_agents`
- O vínculo usuário-agente será criado com `user_id`, `agent_id` e `cod_agent`
- A tela de detalhes/edição do agente (e qualquer fetch pós-salvamento) deixa de gerar erro 500
