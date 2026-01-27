
# Plano: Unificar Busca de Agentes via `user_agents`

## Contexto do Problema

Atualmente, a busca de agentes no filtro do CRM (`useCRMAgents`) usa lógicas diferentes por role:
- **Admin**: Busca todos os agentes da view `vw_list_client-agents-users`
- **User**: Busca usando `user.cod_agent` direto (campo do usuário)

**Problema identificado**: Usuários com `role='time'` têm `cod_agent = null` no registro do usuário, pois seus agentes estão apenas na tabela `user_agents`. Isso faz o filtro retornar vazio.

**Solução**: Todos os roles devem buscar os agentes vinculados na tabela `user_agents` baseado no `user_id`.

---

## Mudanças Necessárias

### 1. Criar nova action na Edge Function `db-query`

Adicionar action `get_crm_agents_for_user` que busca os agentes do usuário pela tabela `user_agents`:

```sql
SELECT DISTINCT 
  ua.cod_agent::text as cod_agent,
  c.name as owner_name,
  c.business_name as owner_business_name
FROM user_agents ua
JOIN agents a ON a.id = ua.agent_id
JOIN clients c ON c.id = a.client_id
WHERE ua.user_id = $1
ORDER BY c.name
```

### 2. Atualizar `externalDb.ts`

Adicionar método helper `getCrmAgentsForUser(userId: number)`.

### 3. Atualizar `useCRMAgents` em `useCRMData.ts`

Modificar o hook para:
- Usar a nova action `get_crm_agents_for_user` passando `user.id`
- Funciona para todos os roles (admin, user, time)
- Remove a lógica condicional atual baseada em role

---

## Detalhes Técnicos

### Nova Action no Backend

**Arquivo**: `supabase/functions/db-query/index.ts`

```typescript
case 'get_crm_agents_for_user': {
  const { userId } = data;
  result = await sql.unsafe(
    `SELECT DISTINCT 
      ua.cod_agent::text as cod_agent,
      c.name as owner_name,
      c.business_name as owner_business_name
    FROM user_agents ua
    JOIN agents a ON a.id = ua.agent_id
    JOIN clients c ON c.id = a.client_id
    WHERE ua.user_id = $1
    ORDER BY c.name`,
    [userId]
  );
  break;
}
```

### Atualização do Hook

**Arquivo**: `src/pages/crm/hooks/useCRMData.ts`

```typescript
export function useCRMAgents() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['crm-agents', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const result = await externalDb.getCrmAgentsForUser(user.id);
      return result;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
}
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/db-query/index.ts` | Adicionar case `get_crm_agents_for_user` |
| `src/lib/externalDb.ts` | Adicionar método `getCrmAgentsForUser` |
| `src/pages/crm/hooks/useCRMData.ts` | Simplificar `useCRMAgents` para usar nova action |

---

## Benefícios

1. **Consistência**: Todos os roles usam a mesma lógica baseada em `user_agents`
2. **Funciona para role='time'**: Membros de equipe verão seus agentes atribuídos
3. **Manutenibilidade**: Remove lógica condicional complexa
4. **Segurança**: Cada usuário só vê os agentes explicitamente vinculados a ele

