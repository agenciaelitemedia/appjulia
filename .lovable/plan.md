
# Plano: Filtro "Mostrar Legado" na Listagem de Agentes

## Objetivo
Adicionar um toggle/checkbox "Mostrar Legado" na página `/admin/agentes` que filtra os agentes com base na tabela `used_agents`. Quando desmarcado (padrão), mostra apenas agentes com vínculo (`ua.agent_id IS NOT NULL`). Quando marcado, mostra todos os agentes.

---

## Lógica do Filtro

| Toggle "Mostrar Legado" | Comportamento |
|-------------------------|---------------|
| `false` (padrão) | Filtra apenas `ua.agent_id IS NOT NULL` (agentes não-legados) |
| `true` | Lista todos os agentes (inclui legados sem vínculo em `used_agents`) |

---

## Alterações Planejadas

### 1. Edge Function `db-query` - Nova Query

**Arquivo**: `supabase/functions/db-query/index.ts`

Modificar o case `get_agents_list` para:
1. Aceitar um parâmetro `showLegacy` (boolean)
2. Usar a nova query com JOIN na tabela `used_agents`
3. Aplicar filtro condicional baseado no parâmetro

**Query Base (conforme especificado)**:
```sql
SELECT 
  a.id,
  a.cod_agent,
  a.status,
  a.settings,
  c.name AS client_name,
  c.business_name,
  ap.name AS plan_name,
  COALESCE(ap."limit", 0) AS plan_limit,
  COALESCE(leads.count, 0) AS leads_received,
  a.last_used,
  a.due_date,
  ua.agent_id AS user_agent_id
FROM agents a
JOIN clients c ON c.id = a.client_id
LEFT JOIN agents_plan ap ON ap.id = a.agent_plan_id
LEFT JOIN used_agents ua ON ua.agent_id = a.id AND ua.cod_agent = a.cod_agent
LEFT JOIN (
  SELECT s.agent_id, COUNT(DISTINCT s.id) as count
  FROM sessions s
  INNER JOIN log_messages lm ON lm.session_id = s.id
  WHERE lm.created_at >= DATE_TRUNC('month', CURRENT_DATE)
    AND lm.created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
  GROUP BY s.agent_id
) leads ON leads.agent_id = a.id
WHERE a.is_visibilided = true
  ${showLegacy ? '' : 'AND ua.agent_id IS NOT NULL'}
ORDER BY c.business_name
```

---

### 2. Método `getAgentsList` no ExternalDb

**Arquivo**: `src/lib/externalDb.ts`

Modificar o método para aceitar um parâmetro opcional `showLegacy`:

```typescript
async getAgentsList<T = any>(showLegacy: boolean = false): Promise<T[]> {
  return this.invoke({
    action: 'get_agents_list',
    data: { showLegacy },
  });
}
```

---

### 3. Hook `useAgentsList`

**Arquivo**: `src/pages/agents/hooks/useAgentsList.ts`

Modificar o hook para:
1. Aceitar `showLegacy` como parâmetro
2. Incluir no `queryKey` para cache correto
3. Adicionar `user_agent_id` no tipo `AgentListItem`

```typescript
export interface AgentListItem {
  id: number;
  cod_agent: string;
  status: boolean;
  settings: Record<string, unknown> | null;
  client_name: string;
  business_name: string;
  plan_name: string | null;
  plan_limit: number;
  leads_received: number;
  last_used: number | string | null;
  due_date: number | string | null;
  user_agent_id: number | null; // Novo campo
}

export function useAgentsList(showLegacy: boolean = false) {
  return useQuery({
    queryKey: ['agents-list', showLegacy],
    queryFn: () => externalDb.getAgentsList<AgentListItem>(showLegacy),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}
```

---

### 4. Componente `AgentsList`

**Arquivo**: `src/pages/agents/AgentsList.tsx`

Adicionar:
1. Estado `showLegacy` (padrão: `false`)
2. Checkbox/toggle com label "Mostrar Legado" ao lado do campo de busca
3. Passar o estado para o hook `useAgentsList`

**Localização do toggle**: Ao lado direito do campo de busca

```text
┌─────────────────────────────────────────────────────────────┐
│ [🔍 Buscar por nome ou código...]     ☑ Mostrar Legado     │
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/db-query/index.ts` | Atualizar query `get_agents_list` com JOIN em `used_agents` e filtro condicional |
| `src/lib/externalDb.ts` | Adicionar parâmetro `showLegacy` ao método `getAgentsList` |
| `src/pages/agents/hooks/useAgentsList.ts` | Adicionar parâmetro `showLegacy`, atualizar tipo e queryKey |
| `src/pages/agents/AgentsList.tsx` | Adicionar estado e Checkbox "Mostrar Legado" |

---

## Detalhamento Técnico

### Edge Function (db-query/index.ts)

```typescript
case 'get_agents_list': {
  const { showLegacy } = data || {};
  const legacyFilter = showLegacy ? '' : 'AND ua.agent_id IS NOT NULL';
  
  result = await sql.unsafe(`
    SELECT 
      a.id,
      a.cod_agent,
      a.status,
      a.settings,
      c.name AS client_name,
      c.business_name,
      ap.name AS plan_name,
      COALESCE(ap."limit", 0) AS plan_limit,
      COALESCE(leads.count, 0) AS leads_received,
      a.last_used,
      a.due_date,
      ua.agent_id AS user_agent_id
    FROM agents a
    JOIN clients c ON c.id = a.client_id
    LEFT JOIN agents_plan ap ON ap.id = a.agent_plan_id
    LEFT JOIN used_agents ua ON ua.agent_id = a.id AND ua.cod_agent = a.cod_agent
    LEFT JOIN (
      SELECT s.agent_id, COUNT(DISTINCT s.id) as count
      FROM sessions s
      INNER JOIN log_messages lm ON lm.session_id = s.id
      WHERE lm.created_at >= DATE_TRUNC('month', CURRENT_DATE)
        AND lm.created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      GROUP BY s.agent_id
    ) leads ON leads.agent_id = a.id
    WHERE a.is_visibilided = true
      ${legacyFilter}
    ORDER BY c.business_name
  `);
  break;
}
```

### Componente AgentsList (trecho UI)

```tsx
// Estado
const [showLegacy, setShowLegacy] = useState(false);

// Hook com parâmetro
const { data: agents = [], isLoading, refetch } = useAgentsList(showLegacy);

// UI - ao lado do campo de busca
<div className="flex items-center gap-4">
  <div className="relative flex-1 max-w-sm">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="Buscar por nome ou código..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="pl-9"
    />
  </div>
  
  {/* Toggle Mostrar Legado */}
  <div className="flex items-center gap-2">
    <Checkbox
      id="show-legacy"
      checked={showLegacy}
      onCheckedChange={(checked) => setShowLegacy(checked === true)}
    />
    <label 
      htmlFor="show-legacy" 
      className="text-sm text-muted-foreground cursor-pointer select-none"
    >
      Mostrar Legado
    </label>
  </div>
</div>
```

---

## Resultado Esperado

1. Por padrão, a listagem mostra apenas agentes com vínculo na tabela `used_agents` (não-legados)
2. Ao marcar "Mostrar Legado", a listagem inclui todos os agentes (mesmo os sem vínculo)
3. O filtro funciona em conjunto com a busca por texto e a ordenação
4. A mudança do toggle dispara nova requisição com cache separado
