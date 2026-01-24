

# Plano: Reformulação do Editor de Etapas de FollowUp

## Resumo
Modificar o CadenceStepEditor para usar inputs separados de quantidade e tipo de tempo (como na imagem de referência), adicionar validações de mensagem baseadas na flag de mensagem automática, e implementar limites de etapas.

---

## Mudanças Visuais - Intervalo de Tempo

### Estrutura Atual
```text
┌─────────────────────────────────────────────────┐
│  Etapa 1                                        │
│  ┌───────────────────────────────────────────┐  │
│  │  ▼ Selecione o intervalo                  │  │
│  │    • 5 minutos                            │  │
│  │    • 10 minutos                           │  │
│  │    • 1 hora                               │  │
│  │    • 1 dia                                │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Nova Estrutura (como na imagem)
```text
┌──────────────────────────────────────────────────────┐
│  Etapa 1                                        [🗑] │
│                                                      │
│  Intervalo ⓘ                                         │
│  ┌─────────────┐  ┌────────────────────────────┐    │
│  │      5      │  │  ▼ Minutos                 │    │
│  └─────────────┘  │    • Minutos               │    │
│   (número 5-999)  │    • Horas                 │    │
│                   │    • Dias                  │    │
│                   └────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

---

## Lógica de Armazenamento no Banco

### Formato Atual
```typescript
// step_cadence no banco
{
  "cadence_1": "5 minutes",
  "cadence_2": "1 hours", 
  "cadence_3": "2 days"
}
```

### Conversão UI → Banco
| Quantidade | Tipo     | Valor no Banco |
|------------|----------|----------------|
| 5          | Minutos  | `"5 minutes"`  |
| 1          | Horas    | `"1 hours"`    |
| 2          | Dias     | `"2 days"`     |

### Conversão Banco → UI
```typescript
// "5 minutes" → { value: 5, unit: "minutes" }
// "1 hours"   → { value: 1, unit: "hours" }
// "2 days"    → { value: 2, unit: "days" }

function parseInterval(interval: string): { value: number; unit: string } {
  const match = interval.match(/^(\d+)\s+(minutes|hours|days)$/);
  if (match) {
    return { value: parseInt(match[1], 10), unit: match[2] };
  }
  return { value: 5, unit: 'minutes' }; // Default
}
```

---

## Validações

### 1. Tempo Mínimo de 5 Minutos
```typescript
// Validação no input de quantidade
const validateInterval = (value: number, unit: string): number => {
  if (unit === 'minutes' && value < 5) return 5;
  if (value < 1) return 1;
  return value;
};
```

### 2. Máximo de 50 Etapas
```typescript
// Em FollowupConfig.tsx
const handleAddStep = () => {
  if (steps.length >= 50) {
    toast.error('Máximo de 50 etapas atingido');
    return;
  }
  // ... adicionar etapa
};

// Desabilitar botão quando limite atingido
<Button 
  disabled={steps.length >= 50}
  onClick={handleAddStep}
>
  Adicionar Etapa
</Button>
```

### 3. Mensagens Obrigatórias (quando auto_message = false)
```typescript
// Validação antes de salvar
const validateMessages = (): boolean => {
  if (autoMessage) return true; // IA gera mensagens
  
  for (const step of steps) {
    if (!step.message || step.message.trim().split(/\s+/).length < 3) {
      toast.error(`Etapa ${step.key}: mensagem deve ter no mínimo 3 palavras`);
      return false;
    }
  }
  return true;
};
```

---

## Nova Interface CadenceStep

```typescript
export interface CadenceStep {
  key: string;           // cadence_1, cadence_2, etc.
  interval: string;      // "5 minutes", "1 days", etc. (formato banco)
  title: string;         
  message: string | null;
}

// Constantes de tipo de intervalo
export const INTERVAL_UNITS = [
  { value: 'minutes', label: 'Minutos' },
  { value: 'hours', label: 'Horas' },
  { value: 'days', label: 'Dias' },
] as const;
```

---

## Comportamento do Campo de Mensagem

### Quando `autoMessage = true` (Mensagem Automática)
```text
┌─────────────────────────────────────────────────────┐
│  Mensagem                                           │
│  ┌─────────────────────────────────────────────────┐│
│  │ ✨ Mensagem gerada automaticamente pela IA      ││
│  └─────────────────────────────────────────────────┘│
│  (Campo apenas leitura, exibe indicador de IA)      │
└─────────────────────────────────────────────────────┘
```

### Quando `autoMessage = false` (Mensagem Manual)
```text
┌─────────────────────────────────────────────────────┐
│  Mensagem *                                         │
│  ┌─────────────────────────────────────────────────┐│
│  │ Digite a mensagem de follow-up...               ││
│  │                                                  ││
│  │                                                  ││
│  └─────────────────────────────────────────────────┘│
│  150/300 caracteres                                 │
│  ⚠️ Mínimo de 3 palavras obrigatório               │
└─────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

### 1. src/pages/agente/types.ts

Adicionar constantes de unidades de intervalo:

```typescript
// Unidades de intervalo para o select
export const INTERVAL_UNITS = [
  { value: 'minutes', label: 'Minutos' },
  { value: 'hours', label: 'Horas' },
  { value: 'days', label: 'Dias' },
] as const;

// Limites
export const STEP_LIMITS = {
  MAX_STEPS: 50,
  MIN_INTERVAL_MINUTES: 5,
  MIN_MESSAGE_WORDS: 3,
  MAX_MESSAGE_CHARS: 300,
} as const;
```

Remover `INTERVAL_OPTIONS` (não será mais necessário).

---

### 2. src/pages/agente/followup/components/CadenceStepEditor.tsx

Reformular completamente:

```typescript
interface CadenceStepEditorProps {
  step: CadenceStep;
  stepNumber: number;
  autoMessage: boolean;
  onChange: (step: CadenceStep) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function CadenceStepEditor({
  step,
  stepNumber,
  autoMessage,
  onChange,
  onRemove,
  canRemove,
}: CadenceStepEditorProps) {
  // Parse interval string to value and unit
  const parseInterval = (interval: string) => {
    const match = interval.match(/^(\d+)\s+(minutes|hours|days)$/);
    return match 
      ? { value: parseInt(match[1], 10), unit: match[2] }
      : { value: 5, unit: 'minutes' };
  };

  const { value: intervalValue, unit: intervalUnit } = parseInterval(step.interval);

  // Handle interval value change with validation
  const handleIntervalValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = parseInt(e.target.value, 10) || 0;
    
    // Validate minimum for minutes
    if (intervalUnit === 'minutes' && value < 5) {
      value = 5;
    } else if (value < 1) {
      value = 1;
    }
    
    onChange({ ...step, interval: `${value} ${intervalUnit}` });
  };

  // Handle unit change
  const handleIntervalUnitChange = (unit: string) => {
    let value = intervalValue;
    
    // If changing to minutes and current value < 5, adjust
    if (unit === 'minutes' && value < 5) {
      value = 5;
    }
    
    onChange({ ...step, interval: `${value} ${unit}` });
  };

  // Message validation (count words)
  const messageWordCount = step.message?.trim().split(/\s+/).filter(Boolean).length || 0;
  const isMessageValid = autoMessage || messageWordCount >= 3;

  return (
    <Card>
      <CardContent className="p-4">
        {/* Interval: Value + Unit */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            Intervalo
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent>
                Tempo de espera antes de enviar esta mensagem
              </TooltipContent>
            </Tooltip>
          </Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={intervalUnit === 'minutes' ? 5 : 1}
              value={intervalValue}
              onChange={handleIntervalValueChange}
              className="w-24"
            />
            <Select value={intervalUnit} onValueChange={handleIntervalUnitChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_UNITS.map((unit) => (
                  <SelectItem key={unit.value} value={unit.value}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Message Field */}
        <div className="space-y-2 mt-4">
          <Label>
            Mensagem {!autoMessage && '*'}
          </Label>
          
          {autoMessage ? (
            // Read-only AI message indicator
            <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md p-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Mensagem gerada automaticamente pela IA Julia</span>
            </div>
          ) : (
            // Editable message field
            <>
              <Textarea
                value={step.message || ''}
                onChange={(e) => onChange({ ...step, message: e.target.value })}
                placeholder="Digite a mensagem de follow-up..."
                maxLength={300}
                rows={3}
                className={!isMessageValid ? 'border-destructive' : ''}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {!isMessageValid && (
                    <span className="text-destructive">
                      Mínimo de 3 palavras obrigatório
                    </span>
                  )}
                </span>
                <span>{step.message?.length || 0}/300</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### 3. src/pages/agente/followup/components/FollowupConfig.tsx

Adicionar validações e limites:

```typescript
import { STEP_LIMITS } from '../../types';

export function FollowupConfig({ config, isLoading, isSaving, onSave }) {
  // ... existing state

  const handleAddStep = () => {
    if (steps.length >= STEP_LIMITS.MAX_STEPS) {
      toast.error(`Máximo de ${STEP_LIMITS.MAX_STEPS} etapas atingido`);
      return;
    }
    // ... add step logic
  };

  const validateBeforeSave = (): boolean => {
    // Validate messages when auto_message is disabled
    if (!autoMessage) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const wordCount = step.message?.trim().split(/\s+/).filter(Boolean).length || 0;
        
        if (wordCount < STEP_LIMITS.MIN_MESSAGE_WORDS) {
          toast.error(
            `Etapa ${i + 1}: mensagem deve ter no mínimo ${STEP_LIMITS.MIN_MESSAGE_WORDS} palavras`
          );
          return false;
        }
        
        if ((step.message?.length || 0) > STEP_LIMITS.MAX_MESSAGE_CHARS) {
          toast.error(
            `Etapa ${i + 1}: mensagem excede ${STEP_LIMITS.MAX_MESSAGE_CHARS} caracteres`
          );
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = () => {
    if (!validateBeforeSave()) return;
    // ... existing save logic
  };

  return (
    <div>
      {/* Button with limit check */}
      <Button 
        onClick={handleAddStep}
        disabled={steps.length >= STEP_LIMITS.MAX_STEPS}
      >
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Etapa ({steps.length}/{STEP_LIMITS.MAX_STEPS})
      </Button>
      
      {/* ... rest of component */}
    </div>
  );
}
```

---

## Fluxo de Dados

```text
FollowupConfig
    │
    ├── autoMessage: boolean
    │
    └── CadenceStepEditor (para cada etapa)
            │
            ├── Intervalo
            │   ├── Input numérico (min: 5 para minutos, 1 para outros)
            │   └── Select de unidade (Minutos/Horas/Dias)
            │
            └── Mensagem
                ├── Se autoMessage=true → Exibe indicador IA (read-only)
                └── Se autoMessage=false → Textarea editável
                    ├── maxLength: 300
                    └── Validação: mínimo 3 palavras
```

---

## Ordem de Implementação

1. **types.ts** - Adicionar `INTERVAL_UNITS` e `STEP_LIMITS`, remover `INTERVAL_OPTIONS`

2. **CadenceStepEditor.tsx** - Reformular com:
   - Input numérico + Select de unidade para intervalo
   - Lógica de parse/format do formato do banco
   - Campo de mensagem condicional (IA vs manual)
   - Contador de caracteres e validação de palavras

3. **FollowupConfig.tsx** - Adicionar:
   - Limite de 50 etapas com feedback visual
   - Validação de mensagens antes de salvar
   - Contador no botão "Adicionar Etapa"

---

## Seção Técnica

### Parse e Format do Intervalo
```typescript
// Banco → UI
function parseInterval(interval: string): { value: number; unit: string } {
  const match = interval.match(/^(\d+)\s+(minutes|hours|days)$/);
  return match 
    ? { value: parseInt(match[1], 10), unit: match[2] }
    : { value: 5, unit: 'minutes' };
}

// UI → Banco
function formatInterval(value: number, unit: string): string {
  return `${value} ${unit}`;
}
```

### Validação de Mensagem
```typescript
function validateMessage(message: string | null): boolean {
  if (!message) return false;
  const words = message.trim().split(/\s+/).filter(Boolean);
  return words.length >= 3 && message.length <= 300;
}
```

### Regras de Negócio
| Regra | Valor |
|-------|-------|
| Etapas máximas | 50 |
| Tempo mínimo | 5 minutos |
| Palavras mínimas (mensagem) | 3 |
| Caracteres máximos (mensagem) | 300 |

