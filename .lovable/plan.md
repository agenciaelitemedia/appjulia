
# Plano: Adicionar Filtros por Plano e Status na Listagem de Agentes

## Objetivo
Adicionar dois filtros Select na página `/admin/agentes`:
1. **Filtro por Plano**: Dropdown com todos os planos disponíveis
2. **Filtro por Status**: Dropdown com opções "Todos", "Ativo" e "Inativo"

---

## Layout dos Filtros

A barra de filtros ficará organizada assim:

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [🔍 Buscar por nome ou código...]  [Status ▼]  [Plano ▼]  ☑ Mostrar Legado      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Alterações Planejadas

### Arquivo: `src/pages/agents/AgentsList.tsx`

1. **Importar componentes Select e o hook usePlans**:
   - Adicionar imports do `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
   - Importar `usePlans` para obter a lista de planos

2. **Adicionar novos estados**:
   - `statusFilter`: string com valores `'all'` | `'active'` | `'inactive'` (padrão: `'all'`)
   - `planFilter`: string com valor do ID do plano ou `'all'` (padrão: `'all'`)

3. **Carregar planos**:
   - Usar o hook `usePlans()` já existente para obter a lista de planos

4. **Modificar a lógica de filtragem**:
   - O `filteredAgents` useMemo passará a aplicar também os filtros de status e plano além da busca textual

5. **Adicionar os Selects na UI**:
   - Entre o campo de busca e o checkbox "Mostrar Legado"

---

## Detalhamento Técnico

### Novos Estados

```typescript
const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
const [planFilter, setPlanFilter] = useState<string>('all');
```

### Hook para Planos

```typescript
const { plans, isLoading: plansLoading } = usePlans();
```

### Lógica de Filtragem Atualizada

```typescript
const filteredAgents = useMemo(() => {
  let result = agents;
  
  // Filtro por busca textual
  if (debouncedSearch.trim()) {
    const term = debouncedSearch.toLowerCase();
    result = result.filter(agent =>
      agent.business_name?.toLowerCase().includes(term) ||
      agent.client_name?.toLowerCase().includes(term) ||
      agent.cod_agent?.toLowerCase().includes(term)
    );
  }
  
  // Filtro por status
  if (statusFilter !== 'all') {
    const isActive = statusFilter === 'active';
    result = result.filter(agent => agent.status === isActive);
  }
  
  // Filtro por plano
  if (planFilter !== 'all') {
    result = result.filter(agent => agent.plan_name === planFilter);
  }
  
  return result;
}, [agents, debouncedSearch, statusFilter, planFilter]);
```

### UI dos Filtros

```tsx
{/* Search Field and Filters */}
<div className="flex flex-wrap items-center gap-4">
  {/* Campo de Busca */}
  <div className="relative flex-1 min-w-[200px] max-w-sm">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="Buscar por nome ou código..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="pl-9"
    />
  </div>
  
  {/* Filtro por Status */}
  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'active' | 'inactive')}>
    <SelectTrigger className="w-[140px]">
      <SelectValue placeholder="Status" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos</SelectItem>
      <SelectItem value="active">Ativo</SelectItem>
      <SelectItem value="inactive">Inativo</SelectItem>
    </SelectContent>
  </Select>
  
  {/* Filtro por Plano */}
  <Select value={planFilter} onValueChange={setPlanFilter}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="Plano" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos os Planos</SelectItem>
      {plans.map((plan) => (
        <SelectItem key={plan.id} value={plan.name}>
          {plan.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  
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

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/agents/AgentsList.tsx` | Adicionar imports, estados, lógica de filtragem e componentes Select |

---

## Reset de Página

Quando qualquer filtro mudar, a página deve ser resetada para 1:

```typescript
// Reset page when filters change
useEffect(() => {
  setCurrentPage(1);
}, [debouncedSearch, statusFilter, planFilter]);
```

---

## Resultado Esperado

1. Dois Selects aparecem na barra de filtros: "Status" e "Plano"
2. O filtro de Status permite escolher entre "Todos", "Ativo" e "Inativo"
3. O filtro de Plano lista todos os planos disponíveis + opção "Todos os Planos"
4. Os filtros funcionam em conjunto com a busca textual e ordenação
5. A paginação é resetada quando qualquer filtro é alterado
