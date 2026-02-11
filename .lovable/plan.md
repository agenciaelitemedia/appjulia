

## Persistencia Global de Filtros (Periodo + Agentes)

### Situacao Atual

- O **periodo** (dateFrom/dateTo) ja e persistido via `localStorage` (`lovable-quick-period`), mas apenas o nome do preset (ex: "last7days"), nao as datas exatas para periodos customizados.
- Os **agentes selecionados** (`agentCodes`) NAO sao persistidos -- cada pagina inicializa com `[]` e depois preenche com todos os agentes quando o hook de agentes carrega.
- Cada pagina (Dashboard, CRM, Campanhas, Desempenho, Contratos, FollowUp) gerencia seu proprio `useState<UnifiedFiltersState>` independentemente.

### Solucao

Criar um sistema de persistencia centralizado que salva e restaura `agentCodes` no `localStorage`, alem do periodo que ja funciona.

### Arquivos alterados

1. **`src/hooks/usePersistedPeriod.ts`** -- Adicionar funcoes para persistir e recuperar `agentCodes`:
   - `saveAgentCodes(codes: string[])` -- salva no localStorage
   - `getSavedAgentCodes(): string[] | null` -- retorna os codigos salvos (null = nunca salvo, usar todos)
   - Nova chave: `lovable-agent-codes`

2. **`src/components/filters/UnifiedFilters.tsx`** -- Chamar `saveAgentCodes` sempre que os agentes selecionados mudarem (nos handlers `handleAgentToggle`, `handleSelectAllAgents`)

3. **Paginas que usam UnifiedFilters** (6 arquivos) -- Na logica de inicializacao de agentes (`useEffect` que roda quando agents carregam), verificar se ha agentes salvos no localStorage e usar esses ao inves de selecionar todos:
   - `src/pages/Dashboard.tsx`
   - `src/pages/crm/CRMPage.tsx`
   - `src/pages/estrategico/campanhas/CampanhasPage.tsx`
   - `src/pages/estrategico/desempenho/DesempenhoPage.tsx`
   - `src/pages/estrategico/contratos/ContratosPage.tsx`
   - `src/pages/agente/followup/FollowupPage.tsx`

### Detalhes tecnicos

```text
localStorage
  lovable-quick-period  -->  "last7days" (ja existe)
  lovable-agent-codes   -->  ["123","456"] (novo)
```

Logica de inicializacao em cada pagina:
```text
quando agents carregam:
  saved = getSavedAgentCodes()
  se saved != null:
    filtrar apenas os codigos que existem na lista de agents disponíveis
    usar os filtrados
  senao:
    usar todos (comportamento atual, primeira vez)
```

Isso garante que:
- Ao trocar de pagina, os mesmos agentes ficam selecionados
- Se um agente for removido do sistema, ele e ignorado automaticamente
- Na primeira visita (sem dados salvos), todos sao selecionados como hoje
