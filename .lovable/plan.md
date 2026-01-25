
# Plano de Implementacao: Dashboard Principal Aprimorado

## Visao Geral

Este plano implementa tres funcionalidades complementares no Dashboard principal:

1. **Graficos de Evolucao Diaria** - Visualizacao de leads e conversoes ao longo do tempo
2. **Secao Atividade dos Agentes** - Feed em tempo real das movimentacoes de leads
3. **Leads Recentes Clicaveis** - Interatividade para abrir detalhes do lead

---

## Arquitetura da Solucao

```text
+----------------------------------------------------------+
|                     DASHBOARD.TSX                         |
+----------------------------------------------------------+
|  [Header + Botao Atualizar]                               |
|  [UnifiedFilters]                                         |
|                                                           |
|  +------+ +------+ +------+ +------+                     |
|  |Leads | | Msgs | |Conv. | |Agents|  <- Cards KPI       |
|  +------+ +------+ +------+ +------+                     |
|                                                           |
|  +--------------------------------------------------+    |
|  |        GRAFICO EVOLUCAO DIARIA (NOVO)            |    |
|  |  [AreaChart: Leads + Conversoes por dia/hora]    |    |
|  +--------------------------------------------------+    |
|                                                           |
|  +----------------------+ +--------------------------+   |
|  | LEADS RECENTES       | | ATIVIDADE DOS AGENTES    |   |
|  | (clicaveis -> modal) | | (feed de movimentacoes)  |   |
|  +----------------------+ +--------------------------+   |
+----------------------------------------------------------+
```

---

## Parte 1: Graficos de Evolucao Diaria

### 1.1 Novo Hook de Dados

**Arquivo:** `src/pages/dashboard/hooks/useDashboardData.ts`

Adicionar novo hook `useDashboardEvolution` que busca:
- Contagem diaria de leads criados
- Contagem diaria de conversoes (Contrato Assinado)
- Suporte a granularidade horaria quando filtro = 1 dia

**Query SQL (modo diario):**
```sql
SELECT 
  (created_at AT TIME ZONE 'America/Sao_Paulo')::date::text as date,
  COUNT(*) as leads,
  COUNT(CASE WHEN stage_id = (
    SELECT id FROM crm_atendimento_stages WHERE name = 'Contrato Assinado'
  ) THEN 1 END) as conversions
FROM crm_atendimento_cards c
WHERE cod_agent = ANY($1::varchar[])
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $2 AND $3
GROUP BY (created_at AT TIME ZONE 'America/Sao_Paulo')::date
ORDER BY date ASC
```

**Query SQL (modo horario - quando dateFrom = dateTo):**
```sql
SELECT 
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo')::int as hour,
  COUNT(*) as leads,
  COUNT(CASE WHEN stage_id = (
    SELECT id FROM crm_atendimento_stages WHERE name = 'Contrato Assinado'
  ) THEN 1 END) as conversions
FROM crm_atendimento_cards c
WHERE cod_agent = ANY($1::varchar[])
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = $2::date
GROUP BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo')
ORDER BY hour ASC
```

### 1.2 Novo Componente de Grafico

**Arquivo:** `src/pages/dashboard/components/DashboardEvolutionChart.tsx`

Componente baseado no padrao existente `DesempenhoEvolutionChart`:
- Usa Recharts (AreaChart) com duas series: Leads e Conversoes
- Gradientes visuais e cores consistentes com o tema
- Tooltip customizado mostrando valores formatados
- Legenda interativa
- Titulo dinamico baseado na granularidade

**Estrutura do componente:**
```tsx
interface DashboardEvolutionChartProps {
  data: EvolutionData[];
  isLoading?: boolean;
  dateFrom: string;
  dateTo: string;
}

export function DashboardEvolutionChart({ data, isLoading, dateFrom, dateTo }) {
  // Detecta se e dia unico para mostrar por hora
  const isSingleDay = dateFrom === dateTo;
  const chartTitle = isSingleDay 
    ? 'Evolucao por Hora' 
    : 'Evolucao Diaria';
  
  // Renderiza AreaChart com duas Areas (leads, conversions)
}
```

### 1.3 Integracao no Dashboard

Adicionar o grafico entre os Cards KPI e a secao de Leads/Atividade:
- Ocupa largura total
- Altura fixa de ~280px
- Estado de loading com Skeleton

---

## Parte 2: Secao Atividade dos Agentes

### 2.1 Novo Hook de Dados

**Arquivo:** `src/pages/dashboard/hooks/useDashboardData.ts`

Adicionar hook `useDashboardActivity` que reutiliza a logica de `useCRMRecentActivity`:

**Query SQL:**
```sql
SELECT 
  h.id, h.card_id, h.changed_by, h.changed_at, h.notes,
  fs.name as from_stage_name, fs.color as from_stage_color,
  ts.name as to_stage_name, ts.color as to_stage_color,
  c.contact_name, c.whatsapp_number
FROM crm_atendimento_history h
LEFT JOIN crm_atendimento_stages fs ON h.from_stage_id = fs.id
LEFT JOIN crm_atendimento_stages ts ON h.to_stage_id = ts.id
LEFT JOIN crm_atendimento_cards c ON h.card_id = c.id
WHERE c.cod_agent = ANY($1::varchar[])
  AND (h.changed_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $2 AND $3
ORDER BY h.changed_at DESC
LIMIT 10
```

### 2.2 Componente de Timeline Simplificado

Reutilizar o padrao visual do `ActivityTimeline` existente, mas adaptado para o Dashboard:
- Lista compacta de movimentacoes
- Agrupamento por "Hoje", "Ontem", data
- Formato: "[Hora] [Agente] moveu [Lead] de [Fase A] -> [Fase B]"
- Badges coloridos para os estagios
- ScrollArea com altura fixa

### 2.3 Integracao no Dashboard

Substituir o placeholder atual:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Atividade dos Agentes</CardTitle>
    <CardDescription>Ultimas movimentacoes de leads</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Timeline de atividades */}
  </CardContent>
</Card>
```

---

## Parte 3: Leads Recentes Clicaveis

### 3.1 Estado do Modal

**Arquivo:** `src/pages/Dashboard.tsx`

Adicionar estados para controlar o modal de detalhes:
```tsx
const [selectedLead, setSelectedLead] = useState<RecentLead | null>(null);
const [detailsOpen, setDetailsOpen] = useState(false);
```

### 3.2 Hook para Dados Completos do Lead

Criar hook para buscar dados completos quando um lead e selecionado:
```tsx
export function useDashboardLeadDetails(leadId: number | null) {
  return useQuery({
    queryKey: ['dashboard-lead-details', leadId],
    queryFn: async () => {
      // Busca card completo + estagios para o modal
    },
    enabled: leadId !== null,
  });
}
```

### 3.3 Modificar Renderizacao dos Leads

Tornar cada item clicavel:
```tsx
<div 
  key={lead.id} 
  className="flex items-center gap-4 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
  onClick={() => handleLeadClick(lead)}
>
  {/* conteudo existente */}
</div>
```

### 3.4 Integrar CRMLeadDetailsDialog

Reutilizar o componente existente `CRMLeadDetailsDialog`:
```tsx
import { CRMLeadDetailsDialog } from './crm/components/CRMLeadDetailsDialog';

// No render:
<CRMLeadDetailsDialog
  card={selectedCardData}
  stages={stages}
  open={detailsOpen}
  onOpenChange={setDetailsOpen}
/>
```

### 3.5 Buscar Estagios para o Modal

Adicionar hook para buscar estagios (necessario para o modal):
```tsx
export function useDashboardStages() {
  return useQuery({
    queryKey: ['dashboard-stages'],
    queryFn: async () => {
      const result = await externalDb.raw<CRMStage>({
        query: `SELECT id, name, color, position, is_active
                FROM crm_atendimento_stages
                WHERE is_active = true
                ORDER BY position ASC`
      });
      return result;
    },
    staleTime: 1000 * 60 * 10, // 10 min cache
  });
}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/pages/dashboard/hooks/useDashboardData.ts` | Modificar | Adicionar hooks: `useDashboardEvolution`, `useDashboardActivity`, `useDashboardStages`, `useDashboardCardDetails` |
| `src/pages/dashboard/components/DashboardEvolutionChart.tsx` | Criar | Componente de grafico AreaChart com leads e conversoes |
| `src/pages/Dashboard.tsx` | Modificar | Integrar grafico, atividade real, e leads clicaveis com modal |

---

## Detalhes Tecnicos

### Tipos a Adicionar

```typescript
// Em useDashboardData.ts
export interface DashboardEvolutionData {
  date: string;      // "2026-01-25" ou "14" (hora)
  label: string;     // "25/01" ou "14h"
  leads: number;
  conversions: number;
}

export interface DashboardActivity {
  id: number;
  card_id: number;
  contact_name: string;
  whatsapp_number: string;
  from_stage_name: string | null;
  from_stage_color: string | null;
  to_stage_name: string;
  to_stage_color: string;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
}
```

### Invalidacao de Cache no Refresh

Atualizar `handleRefresh` para incluir novas queries:
```typescript
const handleRefresh = async () => {
  setIsRefreshing(true);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard-recent-leads'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard-evolution'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard-activity'] }),
  ]);
  setIsRefreshing(false);
};
```

### Tratamento de Granularidade

Logica para detectar dia unico (seguindo padrao existente):
```typescript
const isSingleDay = useMemo(() => {
  if (!filters.dateFrom || !filters.dateTo) return false;
  return filters.dateFrom === filters.dateTo;
}, [filters.dateFrom, filters.dateTo]);
```

---

## Layout Final do Dashboard

```text
+----------------------------------------------------------+
| Ola, [Nome]! [Atualizar]                                 |
+----------------------------------------------------------+
| [Filtros Unificados - Collapsible]                       |
+----------------------------------------------------------+
| +--------+ +--------+ +--------+ +--------+              |
| | Leads  | | Msgs   | | Conv.  | | Agentes|              |
| |  125   | |  0     | |   8    | |   5    |              |
| +--------+ +--------+ +--------+ +--------+              |
+----------------------------------------------------------+
| +------------------------------------------------------+ |
| |     EVOLUCAO DIARIA DE LEADS E CONVERSOES            | |
| |  [AreaChart com 2 series - altura 280px]             | |
| |  Legenda: ● Leads ● Conversoes                       | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
| +----------------------+ +--------------------------+    |
| | LEADS RECENTES       | | ATIVIDADE DOS AGENTES    |    |
| |                      | |                          |    |
| | [Usuario] - 14:30    | | HOJE                     |    |
| |   Agente • Entrada   | | 14:35 Sistema moveu...   |    |
| |        [clicavel]    | | 14:20 JulIA moveu...     |    |
| |                      | |                          |    |
| | [Usuario] - 13:45    | | ONTEM                    |    |
| |   Agente • Analise   | | 18:40 Sistema moveu...   |    |
| +----------------------+ +--------------------------+    |
+----------------------------------------------------------+
```

---

## Fluxo de Interacao do Usuario

1. **Visualizar Evolucao**: Usuario ve grafico automaticamente ao carregar
2. **Ajustar Periodo**: Ao mudar filtros, grafico atualiza (diario ou horario)
3. **Ver Atividade**: Feed mostra ultimas movimentacoes em tempo real
4. **Clicar em Lead**: Abre modal com detalhes completos e historico
5. **Atualizar**: Botao refresh recarrega todos os dados

---

## Consideracoes de Performance

- Queries limitadas (LIMIT 10 para atividade, LIMIT 5 para leads)
- Cache React Query com staleTime apropriado
- Skeleton loaders para feedback visual
- Queries paralelas onde possivel
- Reuso de componentes existentes (CRMLeadDetailsDialog)
