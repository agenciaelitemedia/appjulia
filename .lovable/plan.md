

# Novo Card "Taxa em FollowUp" + Reorganização do Layout

## Objetivo

Adicionar um novo card que exibe o percentual de leads que continuam em follow ativo (status SEND) e reorganizar os cards em duas linhas temáticas.

## Nova Métrica

| Card | Fórmula | Descrição |
|------|---------|-----------|
| **Taxa em FollowUp** | (leads com state='SEND' / total leads na fila) × 100 | Percentual de leads que ainda estão ativos no follow |

## Novo Layout

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ LINHA 1 - CONTADORES ABSOLUTOS                                              │
├────────────────┬────────────────┬────────────────┬────────────────┬────────────────┤
│ Leads na Fila  │ Leads em       │ Mensagens      │ Respostas      │
│ (total)        │ FollowUp       │ Enviadas       │ (total)        │
│                │ (state=SEND)   │                │                │
└────────────────┴────────────────┴────────────────┴────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ LINHA 2 - TAXAS PERCENTUAIS                                                 │
├────────────────────────┬────────────────────────┬────────────────────────┬──┤
│ Taxa em FollowUp       │ Taxa de Retorno        │ Taxa de Perda          │
│ (waiting/total)%       │ (returned/total)%      │ (lost/total)%          │
└────────────────────────┴────────────────────────┴────────────────────────┘
```

## Arquivos a Modificar

### 1. src/pages/agente/types.ts

Adicionar novo campo `followupRate` às interfaces:

```typescript
export interface FollowupStats {
  total: number;           // Total de leads na fila (qualquer status)
  totalSent: number;       // Total de mensagens enviadas
  waiting: number;         // Leads com state = 'SEND' (ativos)
  stopped: number;         // Total de respostas COUNT(*)
  responseRate: number;    // Taxa de Retorno
  lossRate: number;        // Taxa de Perda
  followupRate: number;    // NOVO: Taxa em FollowUp = (waiting / total) × 100
  previous?: FollowupPreviousStats;
}

export interface FollowupPreviousStats {
  total: number;
  totalSent: number;
  waiting: number;
  stopped: number;
  responseRate: number;
  lossRate: number;
  followupRate: number;    // NOVO
}
```

### 2. src/pages/agente/hooks/useFollowupData.ts

Calcular `followupRate` no retorno dos hooks:

```typescript
// Em useFollowupReturnRate
const followupRate = totalLeads > 0 ? (waiting / totalLeads) * 100 : 0;

return { 
  // ... campos existentes ...
  followupRate,
};

// Em useFollowupPreviousPeriodStats
const followupRate = total > 0 ? (waiting / total) * 100 : 0;
```

### 3. src/pages/agente/followup/FollowupPage.tsx

Atualizar `dashboardStats` para incluir `followupRate`:

```typescript
const dashboardStats: FollowupStats = useMemo(() => {
  const total = queueTotals?.total || 0;
  const waiting = queueTotals?.waiting || 0;
  const followupRate = total > 0 ? (waiting / total) * 100 : 0;
  
  return {
    total,
    waiting,
    totalSent: dailyMetrics.reduce((sum, d) => sum + d.messagesSent, 0),
    stopped: returnData?.responses || 0,
    responseRate: returnData?.returnRate || 0,
    lossRate: returnData?.lossRate || 0,
    followupRate,  // NOVO
    previous: isLoadingPrevious ? undefined : previousStats,
  };
}, [queueTotals, dailyMetrics, returnData, previousStats, isLoadingPrevious]);
```

### 4. src/pages/agente/followup/components/FollowupSummary.tsx

Reorganizar cards em duas linhas e adicionar "Taxa em FollowUp":

```typescript
import { Users } from 'lucide-react';

// Cards da primeira linha (contadores absolutos)
const absoluteCards: CardData[] = [
  {
    title: 'Leads na Fila',
    value: stats.total.toLocaleString('pt-BR'),
    icon: ListTodo,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    change: stats.previous 
      ? calculateChange(stats.total, stats.previous.total) 
      : null,
  },
  {
    title: 'Leads em FollowUp',  // Renomeado de "Aguardando"
    value: stats.waiting.toLocaleString('pt-BR'),
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-500/10',
    change: stats.previous 
      ? calculateChange(stats.waiting, stats.previous.waiting) 
      : null,
  },
  {
    title: 'Mensagens Enviadas',
    value: stats.totalSent.toLocaleString('pt-BR'),
    icon: Send,
    color: 'text-green-600',
    bgColor: 'bg-green-500/10',
    change: stats.previous 
      ? calculateChange(stats.totalSent, stats.previous.totalSent) 
      : null,
  },
  {
    title: 'Respostas',
    value: stats.stopped.toLocaleString('pt-BR'),
    icon: MessageCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    change: stats.previous 
      ? calculateChange(stats.stopped, stats.previous.stopped) 
      : null,
  },
];

// Cards da segunda linha (taxas percentuais)
const rateCards: CardData[] = [
  {
    title: 'Taxa em FollowUp',  // NOVO
    value: `${stats.followupRate.toFixed(1)}%`,
    icon: Users,
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10',
    change: stats.previous 
      ? calculatePpChange(stats.followupRate, stats.previous.followupRate) 
      : null,
  },
  {
    title: 'Taxa de Retorno',
    value: `${stats.responseRate.toFixed(1)}%`,
    icon: TrendingUp,
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10',
    change: stats.previous 
      ? calculatePpChange(stats.responseRate, stats.previous.responseRate) 
      : null,
  },
  {
    title: 'Taxa de Perda',
    value: `${stats.lossRate.toFixed(1)}%`,
    icon: TrendingDown,
    color: 'text-red-600',
    bgColor: 'bg-red-500/10',
    change: stats.previous 
      ? calculatePpChange(stats.lossRate, stats.previous.lossRate) 
      : null,
    invertChange: true,
  },
];

// Renderizar em duas linhas
return (
  <div className="space-y-4">
    {/* Linha 1: Contadores Absolutos */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {absoluteCards.map((card, index) => (
        <Card key={index}>
          {/* ... conteúdo do card ... */}
        </Card>
      ))}
    </div>
    
    {/* Linha 2: Taxas Percentuais */}
    <div className="grid grid-cols-3 gap-4">
      {rateCards.map((card, index) => (
        <Card key={index}>
          {/* ... conteúdo do card ... */}
        </Card>
      ))}
    </div>
  </div>
);
```

## Resumo Visual Final

| Linha | Cards | Grid |
|-------|-------|------|
| **Linha 1** | Leads na Fila, Leads em FollowUp, Mensagens Enviadas, Respostas | 4 colunas |
| **Linha 2** | Taxa em FollowUp, Taxa de Retorno, Taxa de Perda | 3 colunas |

## Seção Técnica

### Ordem de Implementação

1. Atualizar interfaces em `types.ts` (adicionar `followupRate`)
2. Modificar `useFollowupPreviousPeriodStats` para calcular e retornar `followupRate`
3. Atualizar `FollowupPage.tsx` para calcular `followupRate` no `dashboardStats`
4. Reorganizar `FollowupSummary.tsx`:
   - Separar cards em dois arrays (absolutos e taxas)
   - Adicionar card "Taxa em FollowUp"
   - Renomear "Aguardando" para "Leads em FollowUp"
   - Criar layout de duas linhas

### Cálculo da Taxa

A Taxa em FollowUp é calculada localmente no frontend, não precisa de nova query:

```typescript
followupRate = (waiting / total) * 100
// waiting = queueTotals.waiting (já existe)
// total = queueTotals.total (já existe)
```

