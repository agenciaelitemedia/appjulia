
## Adicionar filtro "Todos" (incluir ocultos) para administradores

### O que muda

Ao lado do checkbox "Mostrar Legado", adicionar um novo checkbox **"Todos"** que so aparece para administradores. Quando marcado, a query do backend deixa de filtrar por `is_visibilided = true`, mostrando tambem agentes ocultos.

### Alteracoes

#### 1. `src/pages/agents/AgentsList.tsx`

- Adicionar estado `showAll` (persistido no localStorage junto com os outros filtros)
- Renderizar o checkbox "Todos" apenas quando `isAdmin === true`, posicionado ao lado do "Mostrar Legado"
- Passar `showAll` para o hook `useAgentsList`

#### 2. `src/pages/agents/hooks/useAgentsList.ts`

- Adicionar parametro `showAll` ao hook
- Incluir `showAll` na `queryKey` e passar para `externalDb.getAgentsList`

#### 3. `src/lib/externalDb.ts`

- Alterar `getAgentsList` para aceitar e enviar o parametro `showAll`

#### 4. `supabase/functions/db-query/index.ts` (case `get_agents_list`)

- Ler o parametro `showAll` do `data`
- Quando `showAll` for `true`, remover o filtro `WHERE a.is_visibilided = true`
- Quando `false` (padrao), manter o filtro existente

### Detalhes tecnicos

**Novo estado e persistencia (AgentsList.tsx):**
```typescript
interface StoredFilters {
  showLegacy: boolean;
  showAll: boolean; // novo
  statusFilter: 'all' | 'active' | 'inactive';
  planFilter: string;
}

const [showAll, setShowAll] = useState(storedFilters.showAll);
```

**Checkbox no JSX (ao lado de "Mostrar Legado"):**
```typescript
{isAdmin && (
  <div className="flex items-center gap-2">
    <Checkbox
      id="show-all"
      checked={showAll}
      onCheckedChange={(checked) => setShowAll(checked === true)}
    />
    <label htmlFor="show-all" className="text-sm text-muted-foreground cursor-pointer select-none">
      Todos
    </label>
  </div>
)}
```

**Hook atualizado:**
```typescript
export function useAgentsList(showLegacy: boolean = false, showAll: boolean = false) {
  return useQuery({
    queryKey: ['agents-list', showLegacy, showAll],
    queryFn: () => externalDb.getAgentsList<AgentListItem>(showLegacy, showAll),
  });
}
```

**externalDb.getAgentsList:**
```typescript
async getAgentsList<T = any>(showLegacy: boolean = false, showAll: boolean = false): Promise<T[]> {
  return this.invoke({
    action: 'get_agents_list',
    data: { showLegacy, showAll },
  });
}
```

**Edge function (db-query):**
```typescript
case 'get_agents_list': {
  const { showLegacy, showAll } = data || {};
  const legacyFilter = showLegacy ? '' : 'AND ua.agent_id IS NOT NULL';
  const visibilityFilter = showAll ? '' : 'AND a.is_visibilided = true';

  result = await sql.unsafe(`
    SELECT ...
    FROM agents a
    ...
    WHERE 1=1
      ${visibilityFilter}
      ${legacyFilter}
    ORDER BY c.business_name
  `);
  break;
}
```

### Arquivos modificados

- `src/pages/agents/AgentsList.tsx` — novo checkbox + estado
- `src/pages/agents/hooks/useAgentsList.ts` — novo parametro
- `src/lib/externalDb.ts` — novo parametro no metodo
- `supabase/functions/db-query/index.ts` — filtro condicional de visibilidade
