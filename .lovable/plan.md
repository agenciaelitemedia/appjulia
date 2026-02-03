
# Plano: Dashboard de Analytics para o CRM Builder

## Objetivo
Criar um dashboard de Analytics completo para o CRM Builder que exiba métricas de performance do board, incluindo funil de conversão, tempo médio por etapa, distribuição de valores e evolução temporal.

---

## Arquitetura Proposta

O dashboard será implementado como uma nova aba no **BoardSettingsSheet** (seguindo o padrão existente), mantendo a organização centralizada das configurações e análises do board.

### Componentes a Criar

```text
src/pages/crm-builder/
├── components/
│   └── analytics/
│       ├── BoardAnalyticsDashboard.tsx    # Container principal do dashboard
│       ├── PipelineFunnelChart.tsx        # Funil de conversão entre etapas
│       ├── PipelineAvgTimeChart.tsx       # Tempo médio por etapa
│       ├── DealsValueDistribution.tsx     # Distribuição de valores por etapa
│       └── BoardSummaryCards.tsx          # Cards de resumo (KPIs)
└── hooks/
    └── useCRMBoardAnalytics.ts            # Hook para cálculo de métricas
```

---

## Detalhamento Técnico

### 1. Hook `useCRMBoardAnalytics.ts`

Responsável por calcular todas as métricas de analytics baseado nos deals e pipelines existentes:

**Métricas calculadas:**
- **Total de deals** (abertos, ganhos, perdidos)
- **Valor total** e valor por status
- **Taxa de conversão** (ganhos / total finalizados)
- **Distribuição por pipeline** (contagem e valor)
- **Tempo médio por pipeline** (calculado via `stage_entered_at`)
- **Funil de conversão** (percentual de deals em cada etapa)

**Parâmetros:**
- `deals: CRMDeal[]`
- `pipelines: CRMPipeline[]`

### 2. Componentes de Visualização

#### `BoardSummaryCards.tsx`
4 cards de KPI no topo:
- **Total de Cards** (com breakdown abertos/ganhos/perdidos)
- **Valor Total** (soma de todos os deals abertos)
- **Taxa de Conversão** (ganhos ÷ (ganhos + perdidos) × 100)
- **Tempo Médio Geral** (média de dias no pipeline atual)

#### `PipelineFunnelChart.tsx`
Gráfico de barras horizontais (padrão Recharts já utilizado) mostrando:
- Contagem de deals por pipeline
- Percentual do total
- Cores específicas de cada pipeline
- Taxa de conversão entre etapas adjacentes

#### `PipelineAvgTimeChart.tsx`
Gráfico de barras horizontais exibindo:
- Tempo médio (em dias) que deals permanecem em cada pipeline
- Destaque para pipelines com maior tempo (possíveis gargalos)

#### `DealsValueDistribution.tsx`
Gráfico de barras verticais ou PieChart mostrando:
- Distribuição de valor (R$) por pipeline
- Percentual do valor total em cada etapa

### 3. Integração no `BoardSettingsSheet.tsx`

Adicionar uma nova aba "Analytics" com ícone `BarChart3`:

```tsx
<TabsList className="grid w-full grid-cols-4">
  <TabsTrigger value="analytics">Analytics</TabsTrigger>
  <TabsTrigger value="custom-fields">Campos</TabsTrigger>
  <TabsTrigger value="automations">Automações</TabsTrigger>
  <TabsTrigger value="general">Geral</TabsTrigger>
</TabsList>

<TabsContent value="analytics">
  <BoardAnalyticsDashboard 
    deals={deals} 
    pipelines={pipelines} 
  />
</TabsContent>
```

### 4. Atualização do `BoardPage.tsx`

Passar a prop `deals` para o `BoardSettingsSheet` para que o dashboard tenha acesso aos dados:

```tsx
<BoardSettingsSheet
  open={isSettingsOpen}
  onOpenChange={setIsSettingsOpen}
  boardId={boardId}
  codAgent={codAgent}
  boardName={board.name}
  pipelines={pipelines}
  deals={deals}  // Nova prop
/>
```

---

## Fluxo de Dados

```text
BoardPage
    │
    ├── useCRMDeals() ──────────────┐
    │                               │
    ├── useCRMPipelines() ──────────┼───► BoardSettingsSheet
    │                               │         │
    │                               │         └── BoardAnalyticsDashboard
    │                               │                  │
    │                               └──────────────────┼─► useCRMBoardAnalytics()
    │                                                  │
    │                               ┌──────────────────┘
    │                               │
    │                               ├── BoardSummaryCards
    │                               ├── PipelineFunnelChart
    │                               ├── PipelineAvgTimeChart
    │                               └── DealsValueDistribution
```

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/crm-builder/hooks/useCRMBoardAnalytics.ts` | Hook com cálculos de métricas |
| `src/pages/crm-builder/components/analytics/BoardAnalyticsDashboard.tsx` | Container do dashboard |
| `src/pages/crm-builder/components/analytics/BoardSummaryCards.tsx` | Cards de KPI |
| `src/pages/crm-builder/components/analytics/PipelineFunnelChart.tsx` | Funil de conversão |
| `src/pages/crm-builder/components/analytics/PipelineAvgTimeChart.tsx` | Tempo médio por etapa |
| `src/pages/crm-builder/components/analytics/DealsValueDistribution.tsx` | Distribuição de valores |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `BoardSettingsSheet.tsx` | Adicionar aba Analytics e importar componente |
| `BoardPage.tsx` | Passar prop `deals` para BoardSettingsSheet |
| `types.ts` | Adicionar tipos para analytics (opcional) |

---

## Considerações

1. **Performance**: Os cálculos são feitos no cliente usando `useMemo` para evitar reprocessamento desnecessário
2. **Recharts**: Reutiliza os padrões de gráficos já existentes no projeto (BarChart, AreaChart, PieChart)
3. **Responsividade**: O dashboard se adapta ao tamanho do Sheet (sm:max-w-lg)
4. **Sem banco de dados**: Todas as métricas são calculadas em tempo real a partir dos dados já carregados (deals e pipelines)
