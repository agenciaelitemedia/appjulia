

# Plano: Melhorias no Dashboard de Campanhas Ads

## Visao Geral

Implementar tres melhorias no dashboard de Campanhas Ads:
1. Granularidade por hora no grafico "Evolucao de Leads" quando filtro for de 1 dia
2. Melhorar visualizacao do heatmap "Melhores Horarios" com cores mais visiveis
3. Adicionar comparativo de periodo nos cards de resumo (todos os 6 cards)

---

## 1. Evolucao de Leads com Granularidade Dinamica

### Problema Atual
O grafico sempre mostra dados agrupados por dia, mesmo quando o periodo selecionado e de apenas 1 dia.

### Solucao
Detectar se o periodo e de 1 dia e alternar a query SQL para agrupar por hora.

### Modificacoes

**Arquivo: `src/pages/estrategico/campanhas/hooks/useCampanhasData.ts`**

Atualizar o hook `useCampanhasEvolution`:

```sql
-- Para 1 dia: agrupar por hora
SELECT 
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo')::int as hour,
  COUNT(*)::int as total,
  COUNT(*) FILTER (WHERE LOWER(campaign_data->>'sourceApp') = 'facebook')::int as facebook,
  COUNT(*) FILTER (WHERE LOWER(campaign_data->>'sourceApp') = 'instagram')::int as instagram,
  COUNT(*) FILTER (WHERE LOWER(campaign_data->>'sourceApp') = 'google')::int as google
FROM campaing_ads
WHERE ...
GROUP BY hour
ORDER BY hour ASC
```

**Arquivo: `src/pages/estrategico/campanhas/components/CampanhasEvolutionChart.tsx`**

- Adicionar prop `isSingleDay` para controlar o tipo de visualizacao
- Formatar label do eixo X como "HH:00" para horas ou "dd/MM" para dias
- Atualizar titulo dinamicamente: "Evolucao de Leads por Hora" ou "Evolucao de Leads por Dia"

### Fluxo Visual

```text
┌────────────────────────────────────────────────┐
│  Evolucao de Leads por Hora                    │
│  01 de Fevereiro de 2026                       │
├────────────────────────────────────────────────┤
│                                                │
│  120 ─┐                                        │
│       │    ▓▓                                  │
│  100 ─┤    ▓▓▓▓                                │
│       │  ▓▓▓▓▓▓▓▓                              │
│   80 ─┤  ▓▓▓▓▓▓▓▓▓▓                            │
│       │▓▓▓▓▓▓▓▓▓▓▓▓▓▓                          │
│   60 ─┤▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                        │
│       ├───┬───┬───┬───┬───┬───┬───┬───┬───┬───│
│       08h 09h 10h 11h 12h 13h 14h 15h 16h 17h │
│                                                │
│  [■ Facebook] [■ Instagram] [■ Google]         │
└────────────────────────────────────────────────┘
```

---

## 2. Melhores Horarios com Cores Mais Visiveis

### Problema Atual
O heatmap usa cores de baixo contraste (`bg-chart-2/40`) dificultando a visualizacao.

### Solucao
Usar uma paleta de cores mais vibrante com gradiente de azul para vermelho/laranja.

### Modificacoes

**Arquivo: `src/pages/estrategico/campanhas/components/CampanhasHeatmap.tsx`**

Substituir a funcao `getColor`:

```typescript
const getColor = (count: number) => {
  if (count === 0) return 'bg-slate-100 dark:bg-slate-800';
  const intensity = count / maxCount;
  
  // Gradiente: azul claro -> verde -> amarelo -> laranja -> vermelho
  if (intensity > 0.8) return 'bg-red-500';      // Muito alto
  if (intensity > 0.6) return 'bg-orange-500';   // Alto
  if (intensity > 0.4) return 'bg-yellow-500';   // Medio-Alto
  if (intensity > 0.2) return 'bg-green-500';    // Medio
  return 'bg-blue-400';                          // Baixo
};
```

Atualizar a legenda para refletir as novas cores:

```tsx
<div className="flex gap-1">
  <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800" />
  <div className="w-4 h-4 rounded bg-blue-400" />
  <div className="w-4 h-4 rounded bg-green-500" />
  <div className="w-4 h-4 rounded bg-yellow-500" />
  <div className="w-4 h-4 rounded bg-orange-500" />
  <div className="w-4 h-4 rounded bg-red-500" />
</div>
```

### Resultado Visual

```text
┌──────────────────────────────────────────┐
│  Melhores Horarios                       │
├──────────────────────────────────────────┤
│                                          │
│      0h  3h  6h  9h  12h 15h 18h 21h    │
│  Dom ░░ ░░ ░░ ░░ ░░  ▓▓  ▓▓  ░░        │
│  Seg ░░ ░░ ░░ ██ ██  ██  ▓▓  ░░        │
│  Ter ░░ ░░ ░░ ██ ██  ██  ▓▓  ░░        │
│  Qua ░░ ░░ ░░ ▓▓ ██  ██  ▓▓  ░░        │
│  Qui ░░ ░░ ░░ ▓▓ ██  ██  ▓▓  ░░        │
│  Sex ░░ ░░ ░░ ▓▓ ██  ██  ██  ▓▓        │
│  Sab ░░ ░░ ░░ ░░ ▓▓  ▓▓  ░░  ░░        │
│                                          │
│  [Menos] ░ ▒ ▓ █ ██ [Mais]              │
│                                          │
│  Top: 10h (45 leads) 14h (42) 11h (38)  │
└──────────────────────────────────────────┘
```

---

## 3. Comparativo de Periodo nos Cards de Resumo

### Problema Atual
Apenas alguns cards mostram variacao com o periodo anterior. Os cards "Leads/Campanha", "Plataforma Top" e "Qualificados" nao tem comparativo.

### Solucao
Adicionar indicadores de variacao em todos os 6 cards de resumo.

### Modificacoes

**Arquivo: `src/pages/estrategico/campanhas/hooks/useCampanhasSummary.ts`**

Calcular metricas adicionais do periodo anterior:

```typescript
// Adicionar ao summary:
previousLeadsPerCampaign: number;
previousTopPlatform: string;
previousTopPlatformLeads: number;
```

**Arquivo: `src/pages/estrategico/campanhas/types.ts`**

Estender a interface `CampaignSummary`:

```typescript
interface CampaignSummary {
  // ... campos existentes
  previousLeadsPerCampaign?: number;
  previousTopPlatform?: string;
  previousTopPlatformLeads?: number;
}
```

**Arquivo: `src/pages/estrategico/campanhas/components/CampanhasSummary.tsx`**

Adicionar variacao em todos os cards:

```typescript
const cards = [
  {
    title: 'Campanhas Ativas',
    value: summary.totalCampaigns,
    icon: Megaphone,
    color: 'chart-1',
    variation: campaignsVar, // ja existe
  },
  {
    title: 'Total de Leads',
    value: summary.totalLeads,
    icon: Users,
    color: 'chart-2',
    variation: leadsVar, // ja existe
  },
  {
    title: 'Leads/Campanha',
    value: summary.leadsPerCampaign,
    icon: Target,
    color: 'chart-3',
    variation: leadsPerCampaignVar, // NOVO
  },
  {
    title: 'Taxa de Conversao',
    value: `${summary.conversionRate.toFixed(1)}%`,
    icon: TrendingUp,
    color: 'chart-4',
    variation: conversionVar, // ja existe
    variationSuffix: 'pp',
  },
  {
    title: 'Plataforma Top',
    value: summary.topPlatform,
    subtitle: `${summary.topPlatformLeads} leads`,
    icon: Star,
    color: 'chart-5',
    variation: topPlatformVar, // NOVO - comparar leads da plataforma top
  },
  {
    title: 'Qualificados',
    value: summary.qualifiedLeads,
    icon: CheckCircle2,
    color: 'primary',
    variation: qualifiedVar, // NOVO
  },
];
```

### Resultado Visual

```text
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Campanhas   │ │ Total Leads │ │ Leads/Camp  │
│     24      │ │    1.250    │ │     52      │
│ +15.2% ▲    │ │ +8.3% ▲     │ │ -5.1% ▼     │
└─────────────┘ └─────────────┘ └─────────────┘

┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Conversao   │ │ Plataforma  │ │ Qualificados│
│   12.5%     │ │  Facebook   │ │    156      │
│ +2.1pp ▲    │ │ +22.5% ▲    │ │ +18.7% ▲    │
└─────────────┘ └─────────────┘ └─────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/estrategico/campanhas/hooks/useCampanhasData.ts` | Adicionar logica de granularidade dinamica no hook `useCampanhasEvolution` |
| `src/pages/estrategico/campanhas/components/CampanhasEvolutionChart.tsx` | Receber prop para single-day e formatar labels de hora |
| `src/pages/estrategico/campanhas/components/CampanhasHeatmap.tsx` | Atualizar paleta de cores do heatmap |
| `src/pages/estrategico/campanhas/hooks/useCampanhasSummary.ts` | Calcular metricas adicionais do periodo anterior |
| `src/pages/estrategico/campanhas/types.ts` | Estender interface CampaignSummary |
| `src/pages/estrategico/campanhas/components/CampanhasSummary.tsx` | Adicionar variacao em todos os cards |

---

## Paleta de Cores do Heatmap

| Intensidade | Cor | Classe Tailwind |
|-------------|-----|-----------------|
| 0 (nenhum) | Cinza claro | `bg-slate-100 dark:bg-slate-800` |
| 1-20% | Azul | `bg-blue-400` |
| 21-40% | Verde | `bg-green-500` |
| 41-60% | Amarelo | `bg-yellow-500` |
| 61-80% | Laranja | `bg-orange-500` |
| 81-100% | Vermelho | `bg-red-500` |

