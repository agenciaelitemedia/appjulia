
# Plano de Implementacao: Dashboard KPIs Avancados

## Visao Geral

Este plano implementa quatro melhorias complementares no Dashboard principal:

1. **Comparativo com Periodo Anterior** - Variacao percentual nos KPIs
2. **Mini-Graficos (Sparklines)** - Tendencia visual rapida nos cards
3. **Contagem de Mensagens Real** - Dados do banco via Julia views
4. **Grafico de Evolucao Expandido** - Leads, Qualificados e Contratos Gerados

---

## Arquitetura da Solucao

```text
+------------------------------------------------------------------+
|                         DASHBOARD.TSX                             |
+------------------------------------------------------------------+
|  [Header + Botao Atualizar]                                       |
|  [UnifiedFilters]                                                 |
|                                                                   |
|  +-------------+ +-------------+ +-------------+ +-------------+  |
|  | LEADS       | | MENSAGENS   | | CONVERSOES  | | AGENTES     |  |
|  |   125       | |   3.420     | |     12      | |     5       |  |
|  | +12.5% [~]  | | +8.2%  [~]  | | +50%   [~]  | |             |  |
|  | vs anterior | | vs anterior | | vs anterior | | Selecionados|  |
|  +-------------+ +-------------+ +-------------+ +-------------+  |
|      ^sparkline     ^sparkline      ^sparkline                    |
|                                                                   |
|  +--------------------------------------------------------------+ |
|  |     GRAFICO EVOLUCAO (LEADS + QUALIFICADOS + CONTRATOS)      | |
|  |  [AreaChart com 3 series]                                    | |
|  |  Legenda: ● Leads ● Qualificados ● Contratos Gerados         | |
|  +--------------------------------------------------------------+ |
|                                                                   |
|  +----------------------+ +-----------------------------------+   |
|  | LEADS RECENTES       | | ATIVIDADE DOS AGENTES             |   |
|  +----------------------+ +-----------------------------------+   |
+------------------------------------------------------------------+
```

---

## Parte 1: Comparativo com Periodo Anterior nos KPIs

### 1.1 Novo Hook para Estatisticas do Periodo Anterior

**Arquivo:** `src/pages/dashboard/hooks/useDashboardData.ts`

Criar hook `useDashboardStatsPrevious` seguindo o padrao de `useJuliaSessoesPrevious`:

**Logica:**
- Calcula periodo anterior usando `getPreviousPeriod(dateFrom, dateTo)`
- Executa as mesmas queries de leads/conversoes/mensagens para o periodo anterior
- Retorna dados para comparacao

**Query SQL (periodo anterior):**
```sql
-- Leads no periodo anterior
SELECT COUNT(*) as count 
FROM crm_atendimento_cards 
WHERE cod_agent = ANY($1::varchar[])
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date

-- Conversoes no periodo anterior
SELECT COUNT(*) as count 
FROM crm_atendimento_cards c 
JOIN crm_atendimento_stages s ON c.stage_id = s.id 
WHERE s.name = 'Contrato Assinado' 
  AND c.cod_agent = ANY($1::varchar[])
  AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
  AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date

-- Mensagens no periodo anterior (via vw_desempenho_julia)
SELECT SUM(total_msg::int) as total
FROM vw_desempenho_julia
WHERE cod_agent::text = ANY($1::varchar[])
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
```

### 1.2 Funcao de Calculo de Variacao

Reutilizar o padrao existente em `DesempenhoSummary.tsx`:

```typescript
function calculateChange(current: number, previous: number): {
  value: number;
  isPositive: boolean;
  isNeutral: boolean;
  label: string;
}
```

### 1.3 Atualizacao dos Cards KPI

Modificar os cards em `Dashboard.tsx` para incluir:
- Indicador de variacao com seta (ArrowUpRight/ArrowDownRight)
- Percentual colorido (verde positivo, vermelho negativo)
- Tooltip explicando o periodo comparado
- Usar `TooltipProvider` do padrao existente

---

## Parte 2: Mini-Graficos (Sparklines) nos Cards

### 2.1 Dados para Sparklines

Reutilizar dados do hook `useDashboardEvolution` (ja existente):
- Para Leads: usar array de `leads` por dia/hora
- Para Conversoes: usar array de `conversions` por dia/hora
- Para Mensagens: criar dados similares

### 2.2 Componente Sparkline Reutilizavel

**Arquivo:** `src/pages/dashboard/components/DashboardSparkline.tsx`

Componente compacto usando Recharts `AreaChart`:
- Altura: 30px
- Sem eixos/labels
- Apenas a curva com gradiente sutil
- Responsivo dentro do card

**Estrutura:**
```typescript
interface DashboardSparklineProps {
  data: number[];
  color: string;
  height?: number;
}

export function DashboardSparkline({ data, color, height = 30 }: DashboardSparklineProps) {
  const chartData = data.map((value, index) => ({ value, index }));
  
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

### 2.3 Integracao nos Cards

Adicionar sparkline abaixo do valor numerico em cada card:
- Leads: cor chart-1 (azul)
- Mensagens: cor chart-3 (verde)
- Conversoes: cor chart-2 (roxo)
- Agentes: sem sparkline (numero fixo)

---

## Parte 3: Contagem de Mensagens Real

### 3.1 Atualizar Hook de Estatisticas

**Arquivo:** `src/pages/dashboard/hooks/useDashboardData.ts`

Modificar `useDashboardStats` para incluir query de mensagens:

**Query SQL (mensagens):**
```sql
SELECT COALESCE(SUM(total_msg::int), 0) as total
FROM vw_desempenho_julia
WHERE cod_agent::text = ANY($1::varchar[])
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
```

### 3.2 Atualizacao do Estado

Modificar retorno do hook:
```typescript
return {
  totalLeads: Number(leadsResult[0]?.count) || 0,
  totalMessages: Number(messagesResult[0]?.total) || 0, // NOVO: Dados reais
  conversions: Number(conversionsResult[0]?.count) || 0,
  activeAgents: agentCodes.length,
};
```

---

## Parte 4: Grafico de Evolucao Expandido

### 4.1 Novo Hook para Evolucao Completa

**Arquivo:** `src/pages/dashboard/hooks/useDashboardData.ts`

Modificar `useDashboardEvolution` para incluir 3 metricas:

**Logica de Qualificados:**
- Leads que estao OU ja passaram por: Negociacao, Contrato em Curso, Contrato Assinado
- Usar `crm_atendimento_history` para verificar leads que passaram pelos estagios

**Query SQL (modo diario - 3 series):**
```sql
WITH qualified_stages AS (
  SELECT id FROM crm_atendimento_stages 
  WHERE name IN ('Negociacao', 'Contrato em Curso', 'Contrato Assinado')
),
contracts_generated AS (
  SELECT id FROM crm_atendimento_stages 
  WHERE name = 'Contrato em Curso'
)
SELECT 
  (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date::text as date,
  COUNT(*) as leads,
  COUNT(CASE WHEN c.stage_id IN (SELECT id FROM qualified_stages) 
    OR EXISTS (
      SELECT 1 FROM crm_atendimento_history h 
      WHERE h.card_id = c.id AND h.to_stage_id IN (SELECT id FROM qualified_stages)
    ) THEN 1 END) as qualified,
  COUNT(CASE WHEN c.stage_id IN (SELECT id FROM contracts_generated)
    OR EXISTS (
      SELECT 1 FROM crm_atendimento_history h 
      WHERE h.card_id = c.id AND h.to_stage_id IN (SELECT id FROM contracts_generated)
    ) THEN 1 END) as contracts_generated
FROM crm_atendimento_cards c
WHERE c.cod_agent = ANY($1::varchar[])
  AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
  AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
GROUP BY (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date
ORDER BY date ASC
```

### 4.2 Atualizar Interface de Dados

```typescript
export interface DashboardEvolutionData {
  date: string;
  label: string;
  leads: number;
  qualified: number;        // NOVO
  contractsGenerated: number; // NOVO (substitui conversions)
}
```

### 4.3 Atualizar Componente de Grafico

**Arquivo:** `src/pages/dashboard/components/DashboardEvolutionChart.tsx`

Adicionar terceira serie ao AreaChart:
- Leads: cor chart-1 (azul)
- Qualificados: cor chart-4 (laranja/amarelo)
- Contratos Gerados: cor chart-2 (verde)

Atualizar gradientes, legenda e tooltip para 3 series.

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/pages/dashboard/hooks/useDashboardData.ts` | Modificar | Adicionar `useDashboardStatsPrevious`, query de mensagens, evolucao expandida |
| `src/pages/dashboard/components/DashboardSparkline.tsx` | Criar | Componente de mini-grafico reutilizavel |
| `src/pages/dashboard/components/DashboardEvolutionChart.tsx` | Modificar | 3 series: leads, qualificados, contratos |
| `src/pages/Dashboard.tsx` | Modificar | Integrar comparativos, sparklines e tooltips |

---

## Detalhes Tecnicos

### Tipos a Adicionar/Modificar

```typescript
// Em useDashboardData.ts
export interface DashboardStats {
  totalLeads: number;
  totalMessages: number;  // Agora com dados reais
  conversions: number;
  activeAgents: number;
  // Dados para sparklines
  leadsPerDay?: number[];
  messagesPerDay?: number[];
  conversionsPerDay?: number[];
}

export interface DashboardStatsPrevious {
  totalLeads: number;
  totalMessages: number;
  conversions: number;
}

export interface DashboardEvolutionData {
  date: string;
  label: string;
  leads: number;
  qualified: number;
  contractsGenerated: number;
}
```

### Funcoes Utilitarias

Reutilizar do `dateUtils.ts`:
- `getPreviousPeriod(dateFrom, dateTo)` - Calcula periodo anterior
- `format(parseISO(...), 'dd/MM', { locale: ptBR })` - Formata datas

Reutilizar de componentes existentes:
- `calculateChange()` de DesempenhoSummary.tsx
- Padrao de TooltipProvider com "vs anterior"

### Invalidacao de Cache

Adicionar nova query key ao refresh:
```typescript
const handleRefresh = async () => {
  setIsRefreshing(true);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats-previous'] }), // NOVO
    queryClient.invalidateQueries({ queryKey: ['dashboard-recent-leads'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard-evolution'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard-activity'] }),
  ]);
  setIsRefreshing(false);
};
```

---

## Layout Final dos Cards KPI

```text
+----------------------------------------------------------+
| +-------------+ +-------------+ +-------------+ +--------+|
| | TOTAL LEADS | | MENSAGENS   | | CONVERSOES  | | AGENTS ||
| |             | |             | |             | |        ||
| |    125      | |   3.420     | |     12      | |   5    ||
| | [~~~~~~~~]  | | [~~~~~~~~]  | | [~~~~~~~~]  | |        ||
| |  sparkline  | |  sparkline  | |  sparkline  | |Selecion||
| |             | |             | |             | |        ||
| | ^ +12.5%    | | ^ +8.2%     | | ^ +50.0%    | |        ||
| | vs anterior | | vs anterior | | vs anterior | |        ||
| +-------------+ +-------------+ +-------------+ +--------+|
+----------------------------------------------------------+
```

---

## Estrutura do Card Aprimorado

```tsx
<Card key={stat.title}>
  <CardHeader className="flex flex-row items-center justify-between pb-2">
    <CardTitle className="text-sm font-medium text-muted-foreground">
      {stat.title}
    </CardTitle>
    <stat.icon className="h-4 w-4 text-muted-foreground" />
  </CardHeader>
  <CardContent className="space-y-2">
    {/* Valor principal */}
    <div className="text-2xl font-bold">
      {stat.value.toLocaleString('pt-BR')}
    </div>
    
    {/* Sparkline (se disponivel) */}
    {stat.sparklineData && (
      <DashboardSparkline 
        data={stat.sparklineData} 
        color={stat.sparklineColor} 
      />
    )}
    
    {/* Comparativo (se disponivel) */}
    {stat.change && (
      <div className="flex items-center gap-1 text-xs">
        {stat.change.isPositive ? (
          <ArrowUpRight className="h-3 w-3 text-emerald-500" />
        ) : (
          <ArrowDownRight className="h-3 w-3 text-red-500" />
        )}
        <span className={cn(
          "font-medium",
          stat.change.isPositive 
            ? "text-emerald-600" 
            : "text-red-600"
        )}>
          {stat.change.label}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-muted-foreground cursor-help underline decoration-dotted">
              vs anterior
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{comparisonTooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    )}
  </CardContent>
</Card>
```

---

## Consideracoes de Performance

- Queries paralelas via Promise.all
- Cache React Query com staleTime apropriado
- Sparklines leves (sem eixos, sem labels)
- Reutilizacao de dados existentes (evolutionData para sparklines)
- Query de periodo anterior executada em paralelo com periodo atual

---

## Fluxo de Dados

```text
1. Carrega agents + inicializa filtros
          |
          v
2. Dispara queries em paralelo:
   +---> useDashboardStats (leads, msgs, conversoes)
   +---> useDashboardStatsPrevious (periodo anterior)
   +---> useDashboardEvolution (3 series)
   +---> useRecentLeads
   +---> useDashboardActivity
          |
          v
3. Calcula variacoes: calculateChange(current, previous)
          |
          v
4. Extrai sparklineData do evolutionData
          |
          v
5. Renderiza cards com comparativos + sparklines + tooltips
```

---

## Definicao de "Qualificados"

Seguindo a regra especificada:
- **Qualificados** = Leads que estao OU ja passaram por:
  - Negociacao
  - Contrato em Curso  
  - Contrato Assinado

A query usa UNION de:
1. Leads atualmente nesses estagios (`stage_id IN (...)`)
2. Leads que tem historico de passagem por esses estagios (`EXISTS (SELECT FROM history...)`)

Isso garante contagem correta mesmo para leads que avancaram e retrocederam.
