

# Correção da Query SQL na Lista de Agentes

## Objetivo

Corrigir a query SQL da página `/admin/agentes` para:
1. Usar a tabela correta `sessions` (com 's')
2. Adicionar filtro `is_visibilided = true` no JOIN
3. Contar leads apenas do mês atual

---

## Alteração Necessária

### Arquivo: `src/pages/agents/AgentsList.tsx`

**Localização:** Função `loadAgents()` (linhas ~89-115)

**Query atual:**
```sql
SELECT 
  a.id,
  a.cod_agent,
  a.status,
  a.name AS agent_name,
  c.name AS client_name,
  c.business_name,
  ap.name AS plan_name,
  COALESCE(ap."limit", 0) AS plan_limit,
  (
    SELECT COUNT(DISTINCT s.id)
    FROM session s
    WHERE s.agent_id = a.id
      AND EXISTS (
        SELECT 1 FROM log_messages lm 
        WHERE lm.session_id = s.id
      )
  ) AS leads_received,
  a.last_used,
  a.due_date
FROM agents a
JOIN clients c ON c.id = a.client_id
LEFT JOIN agents_plan ap ON ap.id = a.agent_plan_id
ORDER BY a.name
```

**Query corrigida:**
```sql
SELECT 
  a.id,
  a.cod_agent,
  a.status,
  c.name AS client_name,
  c.business_name,
  ap.name AS plan_name,
  COALESCE(ap."limit", 0) AS plan_limit,
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
  a.last_used,
  a.due_date
FROM agents a
JOIN clients c ON c.id = a.client_id AND a.is_visibilided = true
LEFT JOIN agents_plan ap ON ap.id = a.agent_plan_id
ORDER BY c.business_name
```

---

## Resumo das Correções

| Correção | Antes | Depois |
|----------|-------|--------|
| Tabela de sessões | `session` | `sessions` |
| Campo agent_name | Selecionado | Removido (não existe) |
| Filtro visibilidade | Não tinha | `a.is_visibilided = true` |
| Filtro mês atual | Não tinha | `DATE_TRUNC` no `log_messages.created_at` |
| Ordenação | `a.name` | `c.business_name` |

---

## Interface TypeScript

Atualizar a interface para refletir a remoção do campo `agent_name`:

```typescript
interface AgentListItem {
  id: number;
  cod_agent: string;
  status: 'active' | 'inactive';
  client_name: string;
  business_name: string;
  plan_name: string | null;
  plan_limit: number;
  leads_received: number;
  last_used: string | null;
  due_date: string | null;
}
```

---

## Impacto na UI

- Coluna "Nome/Escritório" exibirá apenas `business_name` ou `client_name`
- Contagem de leads mostrará apenas leads do mês atual
- Apenas agentes com `is_visibilided = true` serão listados

