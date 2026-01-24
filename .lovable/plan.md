
# Plano de Implementação: Tooltips Explicativos e Componente de Filtros Unificado

## Visão Geral

Este plano aborda duas melhorias solicitadas:
1. **Tooltips explicativos** nos cards de resumo mostrando qual período anterior está sendo comparado
2. **Componente de filtros unificado e reutilizável** para padronizar a interface de filtragem em todas as páginas do sistema

---

## Parte 1: Tooltips Explicativos nos Cards de Resumo

### Objetivo
Ao passar o mouse sobre o indicador "vs anterior" nos cards de resumo, exibir um tooltip explicando exatamente qual período está sendo comparado (ex: "Comparando 17/01 - 24/01 com 10/01 - 16/01").

### Arquivos a serem modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/estrategico/desempenho/components/DesempenhoSummary.tsx` | Adicionar tooltip com período anterior |
| `src/pages/estrategico/contratos/components/ContratosSummary.tsx` | Adicionar tooltip com período anterior |
| `src/pages/agente/followup/components/FollowupSummary.tsx` | Adicionar tooltip com período anterior |
| `src/pages/estrategico/desempenho/DesempenhoPage.tsx` | Passar datas de filtro para DesempenhoSummary |
| `src/pages/estrategico/contratos/ContratosPage.tsx` | Passar datas de filtro para ContratosSummary |
| `src/pages/agente/followup/FollowupPage.tsx` | Passar datas de filtro para FollowupSummary |

### Implementação Técnica

1. **Atualizar props dos componentes Summary** para receber `dateFrom` e `dateTo`

2. **Calcular período anterior** usando `getPreviousPeriod` do `dateUtils.ts`

3. **Adicionar Tooltip** ao indicador "vs anterior":
```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getPreviousPeriod } from '@/lib/dateUtils';
import { format, parseISO } from 'date-fns';

// Dentro do componente:
const { previousDateFrom, previousDateTo } = getPreviousPeriod(dateFrom, dateTo);

const tooltipText = `Comparando ${format(parseISO(dateFrom), 'dd/MM')} - ${format(parseISO(dateTo), 'dd/MM')} com ${format(parseISO(previousDateFrom), 'dd/MM')} - ${format(parseISO(previousDateTo), 'dd/MM')}`;

// No JSX:
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="text-muted-foreground hidden sm:inline cursor-help">
        vs anterior
      </span>
    </TooltipTrigger>
    <TooltipContent>
      <p>{tooltipText}</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## Parte 2: Componente de Filtros Unificado

### Objetivo
Criar um único componente `UnifiedFilters` que padronize a interface de filtros em todas as páginas, seguindo o padrão visual da página de Desempenho (com Collapsible, filtros rápidos de período, seleção de agentes, datas, busca e filtros opcionais).

### Novo arquivo a criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/filters/UnifiedFilters.tsx` | Componente de filtros unificado |
| `src/components/filters/types.ts` | Tipos compartilhados para filtros |

### Arquivos a serem modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Dashboard.tsx` | Adicionar filtros unificados |
| `src/pages/crm/CRMPage.tsx` | Substituir CRMFilters por UnifiedFilters |
| `src/pages/crm/statistics/CRMStatisticsPage.tsx` | Substituir CRMFilters por UnifiedFilters |
| `src/pages/crm/monitoring/CRMMonitoringPage.tsx` | Substituir CRMFilters por UnifiedFilters |
| `src/pages/estrategico/desempenho/DesempenhoPage.tsx` | Substituir JuliaFilters por UnifiedFilters |
| `src/pages/estrategico/contratos/ContratosPage.tsx` | Substituir JuliaFilters por UnifiedFilters |
| `src/pages/agente/followup/FollowupPage.tsx` | Substituir FollowupFilters por UnifiedFilters |

### Design do Componente UnifiedFilters

```text
+-------------------------------------------------------------------------+
| [▼ Filtros]                                           [3 agentes]       |
+-------------------------------------------------------------------------+
| Período: [Hoje] [Ontem] [7d] [Semana] [30d] [3m] [Mês]    [Personalizado]|
+-------------------------------------------------------------------------+
| [Agentes ▼]  [Data Início 📅]  [Data Fim 📅]  [Filtros Extras]  [🔍 Busca...] [Limpar] |
+-------------------------------------------------------------------------+
```

### Interface de Props

```typescript
// src/components/filters/types.ts
export interface Agent {
  cod_agent: string;
  owner_name: string;
  owner_business_name?: string;
}

export interface UnifiedFiltersState {
  search: string;
  agentCodes: string[];
  dateFrom: string;
  dateTo: string;
  // Campos opcionais para filtros específicos
  perfilAgent?: 'SDR' | 'CLOSER' | 'ALL';
  statusDocument?: string;
  stateFilter?: string;
}

export interface UnifiedFiltersProps {
  // Dados
  agents: Agent[];
  filters: UnifiedFiltersState;
  onFiltersChange: (filters: UnifiedFiltersState) => void;
  
  // Estado
  isLoading?: boolean;
  
  // Configurações de visibilidade
  showAgentSelector?: boolean;      // default: true
  showSearch?: boolean;             // default: true
  showQuickPeriods?: boolean;       // default: true
  
  // Filtros extras opcionais
  showPerfilFilter?: boolean;       // Para página de Desempenho
  showStatusFilter?: boolean;       // Para página de Contratos
  statusOptions?: string[];
  showStateFilter?: boolean;        // Para página de FollowUp
  stateOptions?: { value: string; label: string }[];
  
  // Personalização
  searchPlaceholder?: string;
  className?: string;
}
```

### Funcionalidades do Componente

1. **Collapsible** - Filtros podem ser recolhidos/expandidos
2. **Quick Periods** - Botões rápidos: Hoje, Ontem, 7 dias, Semana passada, 30 dias, 3 meses, Este mês
3. **Badge de período** - Mostra "Personalizado" quando datas não correspondem aos presets
4. **Seletor de Agentes** - Popover com checkbox para seleção múltipla
5. **Date Pickers** - Calendários para Data Início e Data Fim
6. **Busca** - Campo de busca com ícone
7. **Filtros Extras** - Slots configuráveis para filtros específicos (perfil, status, state)
8. **Botão Limpar** - Reseta todos os filtros para valores padrão
9. **Badge de contagem** - Mostra quantos agentes estão selecionados

### Dashboard Principal

Para a página Dashboard (`src/pages/Dashboard.tsx`), será necessário:

1. Adicionar estado de filtros
2. Criar hook `useDashboardAgents` para buscar agentes
3. Integrar `UnifiedFilters` no topo da página
4. Atualizar queries de estatísticas para usar os filtros

```typescript
// Estrutura básica do Dashboard atualizado
export default function Dashboard() {
  const [filters, setFilters] = useState<UnifiedFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: getTodayInSaoPaulo(),
    dateTo: getTodayInSaoPaulo(),
  });

  const { data: agents = [], isLoading: agentsLoading } = useDashboardAgents();

  // ... inicialização de agentCodes

  return (
    <div className="space-y-6">
      {/* Header existente */}
      
      <UnifiedFilters
        agents={agents}
        filters={filters}
        onFiltersChange={setFilters}
        isLoading={agentsLoading}
        showAgentSelector={user?.role === 'admin'}
      />
      
      {/* Cards de estatísticas - atualizados para usar filtros */}
      {/* ... */}
    </div>
  );
}
```

---

## Sequência de Implementação

### Fase 1: Criar Componente Unificado
1. Criar `src/components/filters/types.ts`
2. Criar `src/components/filters/UnifiedFilters.tsx`

### Fase 2: Adicionar Tooltips
3. Atualizar `DesempenhoSummary.tsx` com tooltip
4. Atualizar `ContratosSummary.tsx` com tooltip
5. Atualizar `FollowupSummary.tsx` com tooltip
6. Passar props de datas nas páginas correspondentes

### Fase 3: Migrar Páginas para Componente Unificado
7. Migrar `CRMPage.tsx`
8. Migrar `CRMStatisticsPage.tsx`
9. Migrar `CRMMonitoringPage.tsx`
10. Migrar `DesempenhoPage.tsx`
11. Migrar `ContratosPage.tsx`
12. Migrar `FollowupPage.tsx`
13. Adicionar filtros ao `Dashboard.tsx`

### Fase 4: Limpeza
14. Remover componentes de filtro antigos (opcional - manter para retrocompatibilidade)
    - `CRMFilters.tsx`
    - `JuliaFilters.tsx`
    - `FollowupFilters.tsx`

---

## Detalhes Técnicos

### Estrutura de Diretórios Final
```text
src/
  components/
    filters/
      UnifiedFilters.tsx    # Componente principal
      types.ts              # Tipos compartilhados
    ui/
      ... (componentes existentes)
```

### Dependências Utilizadas
- `@radix-ui/react-tooltip` (já instalado)
- `@radix-ui/react-collapsible` (já instalado)
- `@radix-ui/react-popover` (já instalado)
- `date-fns` (já instalado)
- Utilitários de `src/lib/dateUtils.ts`

### Compatibilidade
- O componente é compatível com todos os tipos de filtro existentes
- Props opcionais garantem flexibilidade para diferentes páginas
- Mantém consistência visual com o padrão atual da página de Desempenho
