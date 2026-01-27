
# Plano: Unificar Busca de Agentes em Todas as Páginas via `user_agents`

## Problema Identificado

Após analisar o código, identifiquei **três problemas** que impedem a exibição correta de `cod_agent`:

### Problema 1: Query `get_crm_agents_for_user` com JOIN incorreto
A query criada anteriormente usa:
```sql
JOIN agents a ON a.id = ua.agent_id
```

Porém, a maioria dos registros em `user_agents` tem `agent_id = NULL` (apenas `cod_agent` preenchido). A query `get_user_agents` (que funciona em "Meus Agentes") usa um JOIN mais flexível:
```sql
LEFT JOIN agents a ON a.id = ua.agent_id OR a.cod_agent::text = ua.cod_agent::text
```

### Problema 2: `useJuliaAgents` ainda usa lógica antiga
O hook em `src/pages/estrategico/hooks/useJuliaData.ts` ainda usa a lógica baseada em `user.cod_agent`, que retorna vazio para `role='time'`.

### Problema 3: `useDashboardAgents` também usa lógica antiga
O hook em `src/pages/dashboard/hooks/useDashboardData.ts` tem o mesmo problema.

---

## Solução

### 1. Corrigir query `get_crm_agents_for_user` no Backend

**Arquivo**: `supabase/functions/db-query/index.ts`

Alterar de:
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

Para:
```sql
SELECT DISTINCT 
  COALESCE(ua.cod_agent::text, a.cod_agent::text) as cod_agent,
  c.name as owner_name,
  c.business_name as owner_business_name
FROM user_agents ua
LEFT JOIN agents a ON a.id = ua.agent_id OR a.cod_agent::text = ua.cod_agent::text
LEFT JOIN clients c ON c.id = a.client_id
WHERE ua.user_id = $1
  AND (a.id IS NOT NULL)
ORDER BY c.name
```

### 2. Atualizar `useJuliaAgents` para usar a nova action

**Arquivo**: `src/pages/estrategico/hooks/useJuliaData.ts`

De:
```typescript
export function useJuliaAgents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['julia-agents', user?.role, user?.cod_agent],
    queryFn: async () => {
      if (!user) return [];
      const query = user.role === 'admin'
        ? `SELECT DISTINCT cod_agent::text, owner_name...`
        : `SELECT DISTINCT cod_agent::text, owner_name... WHERE cod_agent = $1`;
      const params = user.role === 'admin' ? [] : [user.cod_agent];
      const result = await externalDb.raw<JuliaAgent>({ query, params });
      return result;
    },
    enabled: !!user,
  });
}
```

Para:
```typescript
export function useJuliaAgents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['julia-agents', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return externalDb.getCrmAgentsForUser<JuliaAgent>(user.id);
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
}
```

### 3. Atualizar `useDashboardAgents` para usar a nova action

**Arquivo**: `src/pages/dashboard/hooks/useDashboardData.ts`

Aplicar a mesma alteracao do hook `useJuliaAgents`.

---

## Resumo dos Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `supabase/functions/db-query/index.ts` | Corrigir JOIN na action `get_crm_agents_for_user` |
| `src/pages/estrategico/hooks/useJuliaData.ts` | Alterar `useJuliaAgents` para usar `getCrmAgentsForUser` |
| `src/pages/dashboard/hooks/useDashboardData.ts` | Alterar `useDashboardAgents` para usar `getCrmAgentsForUser` |

---

## Paginas Afetadas

Apos as correcoes, as seguintes paginas funcionarao corretamente para todos os roles:
- CRM (Leads) - `/crm`
- CRM Monitoramento - `/crm/monitoramento`
- CRM Estatisticas - `/crm/estatisticas`
- Desempenho - `/estrategico/desempenho`
- Contratos - `/estrategico/contratos`
- Dashboard - `/dashboard`
- FollowUp - `/agente/followup`

---

## Beneficios

1. **Consistencia**: Todos os hooks de agentes usam a mesma logica baseada em `user_agents`
2. **Funciona para todos os roles**: Admin, User e Time verao seus agentes corretamente
3. **Manutencao simplificada**: Uma unica action no backend para buscar agentes do usuario
4. **Seguranca**: Cada usuario so ve os agentes explicitamente vinculados a ele
