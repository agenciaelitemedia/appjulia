

# Plano: Cálculo de FollowUps Enviados como Soma das Mudanças de Etapas

## Entendimento do Problema

### Situação Atual
- A tabela `followup_queue` armazena **cada envio de followup** como um registro separado
- Cada lead pode ter múltiplos registros (um para cada etapa enviada)
- Atualmente usamos `DISTINCT ON (cod_agent, session_id)` para mostrar apenas o mais recente
- O totalizador "Enviados" conta **leads únicos** que chegaram na última etapa

### O Que Está Errado
O número de "Enviados" não representa a quantidade real de mensagens de followup enviadas.

### Cálculo Correto
- **FollowUps Enviados** = Soma de todas as transições/mudanças de etapa = Contagem de **todos os registros** (não agrupados) que representam envios efetivos

## Lógica de Cálculo

A quantidade de followups enviados pode ser calculada de duas formas:

### Opção 1: Soma dos step_number (etapas máximas por lead)
Para cada lead, o `step_number` máximo indica quantos followups foram enviados:
```sql
SELECT SUM(step_number) as total_enviados
FROM (
  SELECT DISTINCT ON (cod_agent, session_id) step_number
  FROM followup_queue
  WHERE cod_agent IN ($agentCodes)
    AND state IN ('SEND', 'QUEUE')
  ORDER BY cod_agent, session_id, send_date DESC
) as unique_leads
```

### Opção 2: Contagem de registros com state='SEND' (RECOMENDADA)
Cada registro com `state='SEND'` representa um followup que foi efetivamente enviado:
```sql
SELECT COUNT(*) as total_enviados
FROM followup_queue
WHERE cod_agent IN ($agentCodes)
  AND state = 'SEND'
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $dateFrom
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $dateTo
```

## Decisão de Design

Vou usar a **Opção 2** (contagem de registros SEND) porque:
1. Representa exatamente quantas mensagens foram enviadas
2. É mais precisa quando há loops infinitos (reengajamento)
3. Mantém histórico de todos os envios

## Alterações por Arquivo

### 1. src/pages/agente/types.ts

Atualizar a interface de stats para incluir o novo campo:
```typescript
// Interface para stats do FollowUp
export interface FollowupStats {
  totalLeads: number;      // Leads únicos na fila
  totalSent: number;       // Total de mensagens enviadas (soma das etapas)
  waiting: number;         // Leads aguardando próximo envio
  stopped: number;         // Leads pausados
}
```

### 2. src/pages/agente/hooks/useFollowupData.ts

Criar nova função para buscar contagem de mensagens enviadas:
```typescript
// Nova query para contar total de mensagens enviadas (não agrupado)
export function useFollowupSentCount(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-sent-count', filters],
    queryFn: async () => {
      if (!filters.agentCodes.length) return 0;

      const agentPlaceholders = filters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      const params: (string | number)[] = [...filters.agentCodes];

      let whereClause = `cod_agent IN (${agentPlaceholders})`;

      // Date filters
      if (filters.dateFrom) {
        whereClause += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        params.push(filters.dateTo);
      }

      // Conta TODOS os registros com state='SEND' (não agrupados)
      const result = await externalDb.raw<{ count: string }[]>({
        query: `
          SELECT COUNT(*)::text as count
          FROM followup_queue
          WHERE ${whereClause}
            AND state = 'SEND'
        `,
        params,
      });

      return parseInt(result[0]?.count || '0', 10);
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 1000 * 30,
  });
}
```

### 3. src/pages/agente/followup/FollowupPage.tsx

Integrar a nova contagem no cálculo de stats:

```typescript
// Adicionar hook para contagem de mensagens enviadas
const { data: totalSentCount = 0 } = useFollowupSentCount(filters);

// Atualizar cálculo de stats
const stats = useMemo(() => {
  const result = {
    total: filteredItems.length,        // Leads únicos
    totalSent: totalSentCount,          // Total de mensagens enviadas
    waiting: 0,
    stopped: 0,
  };

  filteredItems.forEach(item => {
    if (item.derived_status === 'waiting') result.waiting++;
    else if (item.derived_status === 'stopped') result.stopped++;
  });

  return result;
}, [filteredItems, totalSentCount]);
```

### 4. src/pages/agente/followup/components/FollowupSummary.tsx

Atualizar os cards para refletir os novos campos:

```typescript
interface FollowupSummaryProps {
  stats: {
    total: number;       // Leads únicos na fila
    totalSent: number;   // Quantidade de mensagens enviadas
    waiting: number;     // Leads aguardando
    stopped: number;     // Leads pausados
  };
  isLoading?: boolean;
}

// Atualizar cards:
const cards = [
  {
    title: 'Leads na Fila',
    value: stats.total,
    icon: ListTodo,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    title: 'Aguardando',
    value: stats.waiting,
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-500/10',
  },
  {
    title: 'Mensagens Enviadas',    // ALTERADO: era "Enviados"
    value: stats.totalSent,         // ALTERADO: usa totalSent
    icon: Send,
    color: 'text-green-600',
    bgColor: 'bg-green-500/10',
  },
  {
    title: 'Pausados',
    value: stats.stopped,
    icon: Pause,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
];
```

## Fluxo de Dados Atualizado

```text
FollowupPage
    |
    |-- useFollowupQueue(filters) -> items (DISTINCT ON - leads únicos)
    |-- useFollowupSentCount(filters) -> totalSentCount (COUNT sem agrupamento)
    |
    |-- stats = {
    |       total: leads únicos,
    |       totalSent: mensagens enviadas (do banco),
    |       waiting: calculado client-side,
    |       stopped: calculado client-side
    |   }
    |
    +-- FollowupSummary(stats)
            |-- Card "Leads na Fila": stats.total
            |-- Card "Mensagens Enviadas": stats.totalSent
            |-- Card "Aguardando": stats.waiting
            |-- Card "Pausados": stats.stopped
```

## Interface Visual Atualizada

```text
┌────────────────┬────────────────┬────────────────────┬────────────────┐
│ Leads na Fila  │  Aguardando    │ Mensagens Enviadas │   Pausados     │
│     152        │      98        │       487          │      12        │
│   (únicos)     │   (leads)      │    (total msgs)    │   (leads)      │
└────────────────┴────────────────┴────────────────────┴────────────────┘
```

## Detalhes Técnicos

### Diferença entre as métricas:
| Métrica | O que conta | Query |
|---------|-------------|-------|
| Total na Fila | Leads únicos | `DISTINCT ON (cod_agent, session_id)` |
| Aguardando | Leads únicos aguardando | Filtrado client-side |
| Mensagens Enviadas | Todas as msgs enviadas | `COUNT(*) WHERE state='SEND'` |
| Pausados | Leads únicos pausados | Filtrado client-side |

### Exemplo Prático:
- Lead A: step_number = 3, state = QUEUE → 2 mensagens já enviadas + 1 aguardando
- Lead B: step_number = 5, state = STOP → 4 mensagens enviadas + parado na 5ª
- Lead C: step_number = 2, state = SEND → 2 mensagens enviadas

**Totalizadores:**
- Leads na Fila: 3
- Aguardando: 1 (Lead A)
- Mensagens Enviadas: 8 (2+4+2)
- Pausados: 1 (Lead B)

## Ordem de Implementação

1. **useFollowupData.ts**
   - Criar `useFollowupSentCount()` com query não agrupada

2. **types.ts**
   - Adicionar interface `FollowupStats` (opcional, para documentação)

3. **FollowupPage.tsx**
   - Importar e usar `useFollowupSentCount`
   - Atualizar cálculo de `stats` para incluir `totalSent`

4. **FollowupSummary.tsx**
   - Atualizar interface de props
   - Renomear card "Enviados" para "Mensagens Enviadas"
   - Usar `stats.totalSent` em vez de `stats.sent`

