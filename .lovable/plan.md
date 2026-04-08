

# Aplicar `[cod_agent] - alias` em todos os selects e exibições de agente

## Resumo

Substituir `owner_name` por `alias` (com fallback para `owner_name`) em todos os componentes que exibem informações de agente, garantindo consistência visual em todo o sistema.

## Componentes já corretos (usam `alias || owner_name`)

- `AgentSearchSelect.tsx` — já usa alias com fallback
- `JuliaFilters.tsx` — já usa alias com fallback  
- `CRMFilters.tsx` — já usa alias com fallback
- `UnifiedFilters.tsx` — já usa alias com fallback

## Componentes a corrigir

### 1. `AgentPerformanceTable.tsx`
- Linha 134: trocar `{agent.owner_name}` por `{agent.alias || agent.owner_name}`
- Adicionar `alias?: string` ao tipo `CRMAgentPerformance` em `src/pages/crm/types.ts`

### 2. `AgentWorkloadChart.tsx`
- Linha 64: trocar `{agent.owner_name}` por `{agent.alias || agent.owner_name}`
- Adicionar `alias?: string` ao tipo `CRMAgentWorkload` em `src/pages/crm/types.ts`

### 3. `HistoricoTab.tsx` (Telefonia)
- Linhas 80-94: enriquecer `agentsList` com alias do hook `useAgentAliases`
- Adicionar `alias` ao objeto de cada agente no Map

### 4. Tipos em `src/pages/crm/types.ts`
- Adicionar campo `alias?: string` em `CRMAgentPerformance` e `CRMAgentWorkload`

### 5. Hooks que alimentam esses componentes
- Verificar onde `CRMAgentPerformance` e `CRMAgentWorkload` são populados e enriquecer com alias do `useAgentAliases`

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/crm/types.ts` | Adicionar `alias?` aos tipos Performance e Workload |
| `src/pages/crm/statistics/components/AgentPerformanceTable.tsx` | Usar `alias \|\| owner_name` |
| `src/pages/crm/monitoring/components/AgentWorkloadChart.tsx` | Usar `alias \|\| owner_name` |
| `src/pages/telefonia/components/HistoricoTab.tsx` | Enriquecer agentsList com aliases |
| Hooks que alimentam Performance/Workload | Enriquecer dados com alias via `useAgentAliases` |

