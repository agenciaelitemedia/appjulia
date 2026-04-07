

# Corrigir `AdvDashboardPage` para usar `user_agents` em vez de `user.cod_agent`

## Problema

A página `/adv/dashboard` obtém o `cod_agent` diretamente de `user?.cod_agent`, que pode estar vazio ou incorreto. A página `/dashboard` (e todas as páginas do painel estratégico) usa o hook `useJuliaAgents()` que consulta a tabela `user_agents` no banco externo via `getCrmAgentsForUser`. Isso garante que o agente correto seja carregado.

## Correção

### `src/pages/adv/AdvDashboardPage.tsx`

Substituir a lógica de `agentCode` para usar `useJuliaAgents()`:

- Importar `useJuliaAgents` de `src/pages/estrategico/hooks/useJuliaData`
- Chamar `useJuliaAgents()` para obter os agentes do usuário
- Usar o primeiro agente retornado como `agentCode`
- Mostrar loading enquanto os agentes carregam
- Manter a mensagem de "nenhum agente" se a lista vier vazia

Lógica simplificada:
```typescript
const { data: agents = [], isLoading: agentsLoading } = useJuliaAgents();
const agentCode = agents.length > 0 ? agents[0].cod_agent : '';
```

Usar `agentCode` derivado dos agents em vez de `user?.cod_agent` em todos os pontos (filters, queries, guard).

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `src/pages/adv/AdvDashboardPage.tsx` | Usar `useJuliaAgents()` para obter `cod_agent` da tabela `user_agents` |

