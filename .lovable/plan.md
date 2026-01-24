

# Plano: Melhorias na Lista de FollowUp - Agendamento e Ações

## Resumo
Modificar a lista de FollowUp para:
1. Calcular e exibir a **próxima data de envio** baseada no intervalo da etapa atual
2. Substituir o dropdown de ações por **ícones diretos com tooltips** (Conversa, Parar/Retomar, Finalizar)
3. Implementar **ações específicas** com comportamentos distintos para cada operação

---

## Mudanças Visuais - Coluna "Agendado"

### Estrutura Atual
```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Etapa │ Status  │ WhatsApp     │ Cliente    │ Agendado      │ Ações       │
├───────┼─────────┼──────────────┼────────────┼───────────────┼─────────────┤
│ 2/4   │ Aguard. │ +55 (11)...  │ João Silva │ 24/01 14:30   │ [...]       │
└────────────────────────────────────────────────────────────────────────────┘
```

### Nova Estrutura
```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Etapa │ Status  │ WhatsApp     │ Cliente    │ Próximo Envio    │ Ações          │
├───────┼─────────┼──────────────┼────────────┼──────────────────┼────────────────┤
│ 2/4   │ Aguard. │ +55 (11)...  │ João Silva │ 24/01 às 14:30   │ 💬  ⏸  ⏹      │
│       │         │              │            │ (em 2h 15min)    │ (com tooltip)  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Cálculo da Próxima Data de Envio

Para calcular quando será o próximo envio, precisamos:

1. **Obter o intervalo da etapa atual** a partir da config (`step_cadence`)
2. **Somar o intervalo à `send_date`** existente no item

### Fórmula
```text
próximo_envio = send_date + intervalo_etapa_atual
```

### Exemplo
```text
send_date = "2025-01-24 10:00:00"
step_number = 2
step_cadence = { "cadence_1": "5 minutes", "cadence_2": "2 hours", "cadence_3": "1 days" }

intervalo_etapa_2 = "2 hours"
próximo_envio = 2025-01-24 12:00:00
```

---

## Novas Ações com Ícones

Remover o DropdownMenu e exibir ícones diretos com tooltips:

| Ícone | Tooltip | Ação | Comportamento no Banco |
|-------|---------|------|------------------------|
| MessageCircle | "Ver Conversa" | Abre diálogo de mensagens | (nenhum) |
| Pause/Play | "Parar" / "Retomar" | Alterna status | `state = 'STOP'` ou `state = 'SEND', send_date = NOW(), step_number = 1` |
| Square | "Finalizar" | Encerra definitivamente | `state = 'STOP', step_number = 0` |

### Visual das Ações
```text
┌─────────────────────────────────────────────────┐
│  💬        ⏸        ⏹                          │
│  Ver      Parar    Finalizar                   │
│  Conversa                                       │
│                                                 │
│  (ao hover, mostra tooltip)                    │
└─────────────────────────────────────────────────┘
```

### Comportamentos Detalhados

**1. Parar (quando `state !== 'STOP'`)**
```sql
UPDATE followup_queue 
SET state = 'STOP' 
WHERE id = $1
```

**2. Retomar (quando `state === 'STOP' AND step_number > 0`)**
```sql
UPDATE followup_queue 
SET state = 'SEND', 
    send_date = NOW(), 
    step_number = 1 
WHERE id = $1
```

**3. Finalizar**
```sql
UPDATE followup_queue 
SET state = 'STOP', 
    step_number = 0 
WHERE id = $1
```

---

## Arquivos a Modificar

### 1. src/pages/agente/types.ts

Adicionar interface para config parseada no FollowupQueue:

```typescript
// Tipo para intervalo parseado
export interface ParsedStepCadence {
  [key: string]: {
    value: number;
    unit: 'minutes' | 'hours' | 'days';
  };
}

// Função para calcular próxima data baseada no intervalo
export function calculateNextSendDate(
  sendDate: string, 
  stepNumber: number, 
  stepCadence: Record<string, string>
): Date | null {
  const cadenceKey = `cadence_${stepNumber}`;
  const interval = stepCadence[cadenceKey];
  
  if (!interval) return null;
  
  const { value, unit } = parseInterval(interval);
  const date = new Date(sendDate);
  
  switch (unit) {
    case 'minutes':
      date.setMinutes(date.getMinutes() + value);
      break;
    case 'hours':
      date.setHours(date.getHours() + value);
      break;
    case 'days':
      date.setDate(date.getDate() + value);
      break;
  }
  
  return date;
}
```

---

### 2. src/pages/agente/followup/FollowupPage.tsx

Passar `step_cadence` parseado para o `FollowupQueue`:

```typescript
// Extrair step_cadence da config
const stepCadence = useMemo(() => {
  if (!config?.step_cadence) return {};
  return parseJsonField<Record<string, string>>(config.step_cadence, {});
}, [config]);

// No componente FollowupQueue, adicionar prop:
<FollowupQueue
  items={filteredItems}
  stepCadence={stepCadence}  // <-- NOVO
  isLoading={isLoadingQueue}
  onUpdateState={handleUpdateState}
  onRestart={handleRestart}  // <-- NOVO
  onFinalize={handleFinalize}  // <-- NOVO
  onDelete={handleDeleteItem}
  isUpdating={...}
  searchTerm={searchTerm}
  onSearchChange={setSearchTerm}
/>
```

---

### 3. src/pages/agente/hooks/useFollowupData.ts

Adicionar novas mutations para ações específicas:

```typescript
// Restart: SEND + NOW() + step_number = 1
export function useRestartQueueItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      return externalDb.raw({
        query: `
          UPDATE followup_queue 
          SET state = 'SEND', 
              send_date = NOW(), 
              step_number = 1 
          WHERE id = $1 
          RETURNING *
        `,
        params: [id],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-queue'] });
      toast({
        title: 'FollowUp retomado',
        description: 'O lead voltou para a etapa 1 e será processado.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao retomar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });
}

// Finalize: STOP + step_number = 0
export function useFinalizeQueueItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      return externalDb.raw({
        query: `
          UPDATE followup_queue 
          SET state = 'STOP', 
              step_number = 0 
          WHERE id = $1 
          RETURNING *
        `,
        params: [id],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-queue'] });
      toast({
        title: 'FollowUp finalizado',
        description: 'O lead foi removido permanentemente da fila.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao finalizar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });
}
```

---

### 4. src/pages/agente/followup/components/FollowupQueue.tsx

Reformular completamente as ações e adicionar cálculo de próximo envio:

```typescript
import { 
  MessageCircle, 
  Pause, 
  Play, 
  Square, // Finalizar
  Search, 
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { calculateNextSendDate } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FollowupQueueProps {
  items: FollowupQueueItemEnriched[];
  stepCadence: Record<string, string>;  // NOVO
  isLoading?: boolean;
  onUpdateState: (id: number, state: string) => void;
  onRestart: (id: number) => void;  // NOVO
  onFinalize: (id: number) => void;  // NOVO
  onDelete: (id: number) => void;
  isUpdating?: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

// Componente para exibir próximo envio
function NextSendCell({ 
  sendDate, 
  stepNumber, 
  stepCadence,
  state 
}: { 
  sendDate: string; 
  stepNumber: number; 
  stepCadence: Record<string, string>;
  state: string;
}) {
  // Se finalizado (step_number = 0) ou parado, não mostrar próximo envio
  if (stepNumber === 0 || state === 'STOP') {
    return <span className="text-muted-foreground">-</span>;
  }
  
  const nextDate = calculateNextSendDate(sendDate, stepNumber, stepCadence);
  
  if (!nextDate) {
    return <span className="text-muted-foreground">-</span>;
  }
  
  const now = new Date();
  const isPast = nextDate < now;
  
  return (
    <div className="flex flex-col">
      <span className={isPast ? 'text-orange-500' : ''}>
        {format(nextDate, 'dd/MM', { locale: ptBR })} às {format(nextDate, 'HH:mm')}
      </span>
      <span className="text-xs text-muted-foreground">
        {isPast 
          ? 'Aguardando processamento' 
          : formatDistanceToNow(nextDate, { addSuffix: true, locale: ptBR })
        }
      </span>
    </div>
  );
}

// Componente de ações com ícones e tooltips
function ActionButtons({
  item,
  onOpenMessages,
  onStop,
  onRestart,
  onFinalize,
  isUpdating,
}: {
  item: FollowupQueueItemEnriched;
  onOpenMessages: () => void;
  onStop: () => void;
  onRestart: () => void;
  onFinalize: () => void;
  isUpdating?: boolean;
}) {
  const isStopped = item.state === 'STOP';
  const isFinalized = item.step_number === 0;
  
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex items-center justify-end gap-1">
        {/* Ver Conversa */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={onOpenMessages}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ver Conversa</TooltipContent>
        </Tooltip>
        
        {/* Parar / Retomar */}
        {!isFinalized && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={isStopped ? onRestart : onStop}
                disabled={isUpdating}
              >
                {isStopped ? (
                  <Play className="h-4 w-4 text-green-500" />
                ) : (
                  <Pause className="h-4 w-4 text-yellow-500" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isStopped ? 'Retomar (volta para etapa 1)' : 'Parar'}
            </TooltipContent>
          </Tooltip>
        )}
        
        {/* Finalizar */}
        {!isFinalized && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={onFinalize}
                disabled={isUpdating}
              >
                <Square className="h-4 w-4 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Finalizar FollowUp</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
```

---

## Fluxo de Dados Atualizado

```text
FollowupPage
    │
    ├── config.step_cadence (parseado)
    │
    └── FollowupQueue
            │
            ├── Coluna "Próximo Envio"
            │   └── calculateNextSendDate(send_date, step_number, step_cadence)
            │
            └── ActionButtons
                ├── Ver Conversa → WhatsAppMessagesDialog
                ├── Parar → onUpdateState(id, 'STOP')
                ├── Retomar → onRestart(id) → SEND + NOW() + step=1
                └── Finalizar → onFinalize(id) → STOP + step=0
```

---

## Ordem de Implementação

1. **types.ts** - Adicionar função `calculateNextSendDate`

2. **useFollowupData.ts** - Adicionar `useRestartQueueItem` e `useFinalizeQueueItem`

3. **FollowupPage.tsx** - Extrair `stepCadence`, adicionar handlers e passar props

4. **FollowupQueue.tsx** - Reformular com:
   - Componente `NextSendCell` para calcular e exibir próximo envio
   - Componente `ActionButtons` com ícones e tooltips
   - Remover DropdownMenu
   - Remover botão de delete (substitui por Finalizar)

---

## Seção Técnica

### Cálculo de Próximo Envio
```typescript
function calculateNextSendDate(
  sendDate: string, 
  stepNumber: number, 
  stepCadence: Record<string, string>
): Date | null {
  const cadenceKey = `cadence_${stepNumber}`;
  const interval = stepCadence[cadenceKey];
  
  if (!interval) return null;
  
  const { value, unit } = parseInterval(interval);
  const date = new Date(sendDate);
  
  switch (unit) {
    case 'minutes': date.setMinutes(date.getMinutes() + value); break;
    case 'hours': date.setHours(date.getHours() + value); break;
    case 'days': date.setDate(date.getDate() + value); break;
  }
  
  return date;
}
```

### Queries SQL
```sql
-- Parar
UPDATE followup_queue SET state = 'STOP' WHERE id = $1

-- Retomar (volta para etapa 1)
UPDATE followup_queue 
SET state = 'SEND', send_date = NOW(), step_number = 1 
WHERE id = $1

-- Finalizar (remove da fila)
UPDATE followup_queue 
SET state = 'STOP', step_number = 0 
WHERE id = $1
```

### Status Visual Baseado em step_number
| step_number | state | Visual |
|-------------|-------|--------|
| > 0 | SEND/QUEUE | Aguardando / Enviado |
| > 0 | STOP | Parado (pode retomar) |
| = 0 | STOP | Finalizado (sem ações) |

