
# Plano: Otimizar Performance da Lista de Agentes

## Problema Identificado

A query atual na pagina `/admin/agentes` possui um **gargalo critico de performance**: uma **subquery correlacionada** que e executada para cada agente individualmente.

### Query Atual (Lenta)

```sql
SELECT 
  a.id,
  ...
  (
    SELECT COUNT(DISTINCT s.id)
    FROM sessions s
    WHERE s.agent_id = a.id
      AND EXISTS (
        SELECT 1 FROM log_messages lm 
        WHERE lm.session_id = s.id
          AND lm.created_at >= DATE_TRUNC('month', CURRENT_DATE)
          AND lm.created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      )
  ) AS leads_received,
  ...
FROM agents a
JOIN clients c ON c.id = a.client_id AND a.is_visibilided = true
LEFT JOIN agents_plan ap ON ap.id = a.agent_plan_id
ORDER BY c.business_name
```

**Problemas:**
1. Subquery correlacionada executada N vezes (uma por agente)
2. EXISTS dentro da subquery adiciona mais overhead
3. Sem indices otimizados para a consulta
4. Ordena todo o resultado mesmo com paginacao client-side

## Solucao Proposta

### 1. Otimizar Query - Usar LEFT JOIN com Agregacao

Substituir a subquery correlacionada por um LEFT JOIN com pre-agregacao:

```sql
SELECT 
  a.id,
  a.cod_agent,
  a.status,
  c.name AS client_name,
  c.business_name,
  ap.name AS plan_name,
  COALESCE(ap."limit", 0) AS plan_limit,
  COALESCE(leads.count, 0) AS leads_received,
  a.last_used,
  a.due_date
FROM agents a
JOIN clients c ON c.id = a.client_id
LEFT JOIN agents_plan ap ON ap.id = a.agent_plan_id
LEFT JOIN (
  SELECT s.agent_id, COUNT(DISTINCT s.id) as count
  FROM sessions s
  INNER JOIN log_messages lm ON lm.session_id = s.id
  WHERE lm.created_at >= DATE_TRUNC('month', CURRENT_DATE)
    AND lm.created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
  GROUP BY s.agent_id
) leads ON leads.agent_id = a.id
WHERE a.is_visibilided = true
ORDER BY c.business_name
```

**Beneficios:**
- Subquery executada apenas UMA vez
- Resultado ja agregado e feito JOIN
- Reducao de N+1 queries para 1+1 queries

### 2. Criar Acao Dedicada na Edge Function

Adicionar nova acao `get_agents_list` no `db-query` com a query otimizada.

### 3. Migrar para React Query

Substituir `useState` + `useEffect` por `useQuery` do TanStack Query para:
- Cache automatico
- Stale-while-revalidate
- Refetch em background
- Melhor UX com estados de loading

### 4. Implementar Debounce na Busca

Adicionar debounce de 300ms no campo de busca para evitar re-renderizacoes excessivas durante digitacao.

## Arquivos a Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/functions/db-query/index.ts` | Modificar | Adicionar acao `get_agents_list` com query otimizada |
| `src/lib/externalDb.ts` | Modificar | Adicionar metodo `getAgentsList()` |
| `src/pages/agents/hooks/useAgentsList.ts` | Criar | Hook com React Query para listagem |
| `src/pages/agents/AgentsList.tsx` | Modificar | Usar novo hook e adicionar debounce |

## Detalhes Tecnicos

### Nova Acao na Edge Function

```typescript
case 'get_agents_list': {
  result = await sql.unsafe(`
    SELECT 
      a.id,
      a.cod_agent,
      a.status,
      c.name AS client_name,
      c.business_name,
      ap.name AS plan_name,
      COALESCE(ap."limit", 0) AS plan_limit,
      COALESCE(leads.count, 0) AS leads_received,
      a.last_used,
      a.due_date
    FROM agents a
    JOIN clients c ON c.id = a.client_id
    LEFT JOIN agents_plan ap ON ap.id = a.agent_plan_id
    LEFT JOIN (
      SELECT s.agent_id, COUNT(DISTINCT s.id) as count
      FROM sessions s
      INNER JOIN log_messages lm ON lm.session_id = s.id
      WHERE lm.created_at >= DATE_TRUNC('month', CURRENT_DATE)
        AND lm.created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      GROUP BY s.agent_id
    ) leads ON leads.agent_id = a.id
    WHERE a.is_visibilided = true
    ORDER BY c.business_name
  `);
  break;
}
```

### Hook com React Query

```typescript
import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';

export function useAgentsList() {
  return useQuery({
    queryKey: ['agents-list'],
    queryFn: () => externalDb.getAgentsList(),
    staleTime: 60000, // 1 minuto
  });
}
```

### Debounce na Busca

```typescript
import { useDebounce } from '@/hooks/useDebounce';

// No componente:
const debouncedSearch = useDebounce(searchTerm, 300);

// Usar debouncedSearch no filtro
const filteredAgents = useMemo(() => {
  if (!debouncedSearch.trim()) return agents;
  // ...
}, [agents, debouncedSearch]);
```

## Estimativa de Melhoria

| Metrica | Antes | Depois |
|---------|-------|--------|
| Queries no banco | N+1 (por agente) | 2 (fixa) |
| Tempo de resposta | ~2-5s (varia com N) | ~200-500ms |
| Re-renders na busca | A cada tecla | Apos 300ms |
| Cache | Nenhum | 1 minuto |

## Fluxo de Implementacao

```text
1. Adicionar acao get_agents_list na Edge Function
2. Adicionar metodo getAgentsList no externalDb
3. Criar hook useAgentsList com React Query
4. Refatorar AgentsList para usar novo hook
5. Adicionar debounce no campo de busca
6. Testar performance
```
