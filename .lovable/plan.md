
# Plano: Corrigir Seleção de Agente no FollowUp

## Problema Identificado

A lógica de seleção de agente no `FollowupPage.tsx` está usando o campo **legado** `user.cod_agent` da tabela `users` em vez de usar os agentes vinculados na tabela `user_agents`.

### Fluxo Atual (Incorreto)
```
useJuliaAgents() → busca user_agents → retorna [202602001]
↓
user.cod_agent → 202512001 (tabela users - legado)
↓
Para não-admin: selectedAgent = user.cod_agent = 202512001 ← SOBRESCREVE!
```

### Dados do Usuário Atual
| Fonte | Campo | Valor |
|-------|-------|-------|
| `users` (legado) | `cod_agent` | 202512001 |
| `user_agents` (correto) | `cod_agent` | 202602001 |

O sistema deveria usar **apenas** os agentes da tabela `user_agents`, ignorando o campo legado.

---

## Solução

Remover a lógica que prioriza `user.cod_agent` e sempre usar o primeiro agente da lista `agents` (que já vem filtrado pela tabela `user_agents`).

---

## Arquivo a Modificar

**`src/pages/agente/followup/FollowupPage.tsx`**

### Código Atual (linhas 99-114):
```typescript
useEffect(() => {
  if (agents.length > 0) {
    // If non-admin user has assigned agent, use that
    if (user?.role !== 'admin' && user?.cod_agent) {
      const userAgentCode = String(user.cod_agent);
      if (selectedAgent !== userAgentCode) {
        setSelectedAgent(userAgentCode);
      }
    } else if (!selectedAgent) {
      // Admin or no assigned agent: select first available
      setSelectedAgent(agents[0].cod_agent);
    }
  }
}, [agents, user?.role, user?.cod_agent]);
```

### Código Corrigido:
```typescript
useEffect(() => {
  if (agents.length > 0 && !selectedAgent) {
    // Sempre usar o primeiro agente da lista (já vem filtrado pela tabela user_agents)
    setSelectedAgent(agents[0].cod_agent);
  }
}, [agents, selectedAgent]);
```

---

## Justificativa

1. **Fonte Única de Verdade**: A tabela `user_agents` é a fonte correta para determinar quais agentes o usuário pode acessar
2. **Consistência**: O hook `useJuliaAgents()` já faz a query correta via `get_crm_agents_for_user`
3. **Elimina Campo Legado**: O campo `users.cod_agent` é legado e pode estar desatualizado
4. **Simplicidade**: Código mais simples e fácil de manter

---

## Impacto

| Antes | Depois |
|-------|--------|
| Não-admin usa `user.cod_agent` (legado) | Todos usam `agents[0]` |
| Admin usa `agents[0]` | Todos usam `agents[0]` |
| Possível inconsistência entre tabelas | Fonte única: `user_agents` |
