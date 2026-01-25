

# Plano de Implementacao: Grafico de Funil e Cores nos Graficos do Dashboard

## Visao Geral

Este plano implementa duas melhorias no Dashboard principal:

1. **Definir cores para graficos** - Adicionar variaveis CSS `--chart-1` a `--chart-5` que estao faltando
2. **Grafico de Funil de CRM** - Adicionar visualizacao da progressao de leads por estagio

---

## Arquitetura da Solucao

```text
+------------------------------------------------------------------+
|                         DASHBOARD.TSX                             |
+------------------------------------------------------------------+
|  [KPI Cards com Sparklines coloridos]                             |
|                                                                   |
|  +--------------------------------------------------------------+ |
|  |  GRAFICO EVOLUCAO (3 series coloridas)                       | |
|  |  Leads (azul) | Qualificados (laranja) | Contratos (verde)   | |
|  +--------------------------------------------------------------+ |
|                                                                   |
|  +--------------------------------------------------------------+ |
|  |         FUNIL DE CONVERSAO (NOVO)                            | |
|  |  [BarChart horizontal com cores por estagio]                 | |
|  |  Entrada -> Analise -> Negociacao -> Contrato -> Assinado    | |
|  +--------------------------------------------------------------+ |
|                                                                   |
|  +----------------------+ +-----------------------------------+   |
|  | LEADS RECENTES       | | ATIVIDADE DOS AGENTES             |   |
|  +----------------------+ +-----------------------------------+   |
+------------------------------------------------------------------+
```

---

## Parte 1: Definir Cores para Graficos no CSS

### 1.1 Adicionar Variaveis CSS

**Arquivo:** `src/index.css`

As variaveis `--chart-1` a `--chart-5` sao referenciadas nos graficos mas nao estao definidas. Adicionar:

```css
:root {
  /* ... variaveis existentes ... */
  
  /* Chart colors */
  --chart-1: 221.2 83.2% 53.3%;  /* Azul vibrante - Leads */
  --chart-2: 142.1 76.2% 36.3%;  /* Verde - Contratos/Conversoes */
  --chart-3: 47.9 95.8% 53.1%;   /* Amarelo/Dourado - Mensagens */
  --chart-4: 24.6 95% 53.1%;     /* Laranja - Qualificados */
  --chart-5: 262.1 83.3% 57.8%;  /* Roxo - Alternativo */
}

.dark {
  /* ... variaveis existentes ... */
  
  /* Chart colors - versoes mais brilhantes para dark mode */
  --chart-1: 217.2 91.2% 59.8%;
  --chart-2: 142.1 70.6% 45.3%;
  --chart-3: 47.9 95.8% 53.1%;
  --chart-4: 27.8 87.1% 55.3%;
  --chart-5: 263.4 70% 50.4%;
}
```

---

## Parte 2: Grafico de Funil de Conversao

### 2.1 Novo Hook para Dados do Funil

**Arquivo:** `src/pages/dashboard/hooks/useDashboardData.ts`

Adicionar hook `useDashboardFunnel` reutilizando a logica de `useCRMFunnelData`:

```typescript
export interface DashboardFunnelData {
  id: number;
  name: string;
  color: string;
  position: number;
  count: number;
  percentage: number;
}

export function useDashboardFunnel(filters: DashboardFiltersState) {
  return useQuery({
    queryKey: ['dashboard-funnel', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const result = await externalDb.raw<DashboardFunnelData>({
        query: `
          SELECT 
            s.id, s.name, s.color, s.position,
            COUNT(c.id)::int as count
          FROM crm_atendimento_stages s
          LEFT JOIN crm_atendimento_cards c ON s.id = c.stage_id
            AND c.cod_agent = ANY($1::varchar[])
            AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          WHERE s.is_active = true
          GROUP BY s.id, s.name, s.color, s.position
          ORDER BY s.position
        `,
        params: [agentCodes, dateFrom, dateTo],
      });
      
      const total = result.reduce((sum, item) => sum + Number(item.count), 0);
      
      return result.map(item => ({
        ...item,
        count: Number(item.count),
        percentage: total > 0 ? (Number(item.count) / total) * 100 : 0,
      }));
    },
    enabled: filters.agentCodes.length > 0,
  });
}
```

### 2.2 Novo Componente de Funil

**Arquivo:** `src/pages/dashboard/components/DashboardFunnelChart.tsx`

Componente baseado no `ConversionFunnelChart` existente, adaptado para o Dashboard:

**Estrutura:**
```tsx
interface DashboardFunnelChartProps {
  data: DashboardFunnelData[];
  isLoading?: boolean;
}

export function DashboardFunnelChart({ data, isLoading }: DashboardFunnelChartProps) {
  // BarChart horizontal com:
  // - Cada barra colorida com a cor do estagio (do banco)
  // - Labels mostrando contagem e percentual
  // - Tooltip customizado
  // - Secao de conversao entre estagios no rodape
}
```

**Caracteristicas:**
- Layout vertical (barras horizontais)
- Cores dinamicas baseadas no campo `color` de cada estagio
- Labels com contagem e percentual
- Tooltip customizado mostrando nome do estagio e metricas
- Indicadores de conversao entre estagios adjacentes

### 2.3 Integracao no Dashboard

**Arquivo:** `src/pages/Dashboard.tsx`

Adicionar o grafico de funil apos o grafico de evolucao:

```tsx
import { DashboardFunnelChart } from './dashboard/components/DashboardFunnelChart';
import { useDashboardFunnel } from './dashboard/hooks/useDashboardData';

// No componente:
const { data: funnelData = [], isLoading: funnelLoading } = useDashboardFunnel(filters);

// No render, apos DashboardEvolutionChart:
<DashboardFunnelChart 
  data={funnelData} 
  isLoading={funnelLoading} 
/>
```

### 2.4 Atualizar Cache no Refresh

Adicionar nova query key ao handleRefresh:

```typescript
const handleRefresh = async () => {
  setIsRefreshing(true);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats-previous'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard-recent-leads'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard-evolution'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard-funnel'] }), // NOVO
    queryClient.invalidateQueries({ queryKey: ['dashboard-activity'] }),
  ]);
  setIsRefreshing(false);
};
```

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/index.css` | Modificar | Adicionar variaveis `--chart-1` a `--chart-5` para light e dark mode |
| `src/pages/dashboard/hooks/useDashboardData.ts` | Modificar | Adicionar hook `useDashboardFunnel` e interface `DashboardFunnelData` |
| `src/pages/dashboard/components/DashboardFunnelChart.tsx` | Criar | Componente de grafico de funil horizontal com cores por estagio |
| `src/pages/Dashboard.tsx` | Modificar | Integrar funil e atualizar refresh |

---

## Detalhes Tecnicos

### Tipos a Adicionar

```typescript
// Em useDashboardData.ts
export interface DashboardFunnelData {
  id: number;
  name: string;
  color: string;
  position: number;
  count: number;
  percentage: number;
}
```

### Paleta de Cores dos Graficos

```text
chart-1 (Azul)     -> Leads no grafico de evolucao
chart-2 (Verde)    -> Contratos Gerados no grafico de evolucao  
chart-3 (Amarelo)  -> Mensagens nos sparklines
chart-4 (Laranja)  -> Qualificados no grafico de evolucao
chart-5 (Roxo)     -> Reserva para uso futuro

Funil: Usa cores proprias de cada estagio (vindas do banco de dados)
```

### Query SQL do Funil

A query agrupa leads por estagio usando `created_at` como filtro de data (diferente da pagina de estatisticas que usa `stage_entered_at`). Isso garante consistencia com os outros dados do dashboard que tambem usam `created_at`.

```sql
SELECT 
  s.id, s.name, s.color, s.position,
  COUNT(c.id)::int as count
FROM crm_atendimento_stages s
LEFT JOIN crm_atendimento_cards c ON s.id = c.stage_id
  AND c.cod_agent = ANY($1::varchar[])
  AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
  AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
WHERE s.is_active = true
GROUP BY s.id, s.name, s.color, s.position
ORDER BY s.position
```

---

## Layout Visual do Funil

```text
+----------------------------------------------------------+
| FUNIL DE CONVERSAO                                        |
+----------------------------------------------------------+
|                                                           |
|  Entrada        ████████████████████████████  45 (35%)   |
|  Analise        ██████████████████            28 (22%)   |
|  Negociacao     ████████████                  18 (14%)   |
|  Contrato Curso ████████                      12 (9%)    |
|  Assinado       ██████                         8 (6%)    |
|  Humano         ████                           5 (4%)    |
|  Desqualificado ████████████                  12 (9%)    |
|                                                           |
|  -------------------------------------------------        |
|  Conversao: Ent->Ana: 62% | Ana->Neg: 64% | Neg->Con: 67%|
+----------------------------------------------------------+
```

---

## Estrutura do Componente de Funil

```tsx
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-base font-medium">Funil de Conversão</CardTitle>
  </CardHeader>
  <CardContent>
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ ... }}>
        <XAxis type="number" hide />
        <YAxis 
          type="category" 
          dataKey="name" 
          width={120}
          tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
        />
        <Tooltip content={CustomTooltip} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={40}>
          {data.map((entry) => (
            <Cell key={entry.id} fill={entry.color} />
          ))}
          <LabelList 
            dataKey="count" 
            position="right" 
            formatter={(v) => `${v} (${percentage}%)`}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    
    {/* Conversao entre estagios */}
    <div className="mt-4 pt-4 border-t">
      <p className="text-sm text-muted-foreground mb-2">
        Conversao entre estagios:
      </p>
      <div className="flex flex-wrap gap-2">
        {/* Badges com taxa de conversao */}
      </div>
    </div>
  </CardContent>
</Card>
```

---

## Consideracoes Visuais

1. **Cores do Funil**: Cada estagio usa sua cor propria do banco de dados (`s.color`), garantindo consistencia visual com o Kanban do CRM

2. **Cores dos Graficos de Evolucao**: Usam as variaveis CSS `--chart-1` a `--chart-4` para manter consistencia do design system

3. **Dark Mode**: As variaveis de cor sao ajustadas no `.dark` para melhor contraste

4. **Responsividade**: O grafico de funil usa `ResponsiveContainer` para adaptar-se a diferentes tamanhos de tela

