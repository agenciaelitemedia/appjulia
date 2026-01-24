
# Plano: Padronizacao Global de Timezone America/Sao_Paulo

## Problema Identificado

O sistema possui inconsistencias na exibicao de datas/horas devido a:
1. **Funcoes duplicadas** de formatacao de data em varios arquivos
2. **Uso de date-fns format()** que usa timezone do navegador (incorreto)
3. **Falta de indicador visual** de que o horario exibido e de Brasilia

### Evidencia das Imagens
- Card mostra "17:38" enquanto relogio do Windows mostra "20:48"
- Diferenca de 3 horas = problema de UTC vs UTC-3

---

## Arquivos Afetados

| Arquivo | Problema | Linha |
|---------|----------|-------|
| `CRMLeadCard.tsx` | Funcao local `formatDateTimeSaoPaulo` duplicada | 12-23 |
| `WhatsAppMessagesDialog.tsx` | Funcoes `formatMessageTime/Date` duplicadas | 1074-1091 |
| `CRMLeadDetailsDialog.tsx` | Usa `format()` do date-fns (timezone incorreto) | 163, 192, 244 |
| `ActivityTimeline.tsx` | Usa `format()`, `isToday()`, `isYesterday()` sem timezone | 15-27, 29-51 |
| `LeadsList.tsx` | Usa `toLocaleDateString()` sem timezone explicito | 121-127 |
| `dateUtils.ts` | So tem `getTodayInSaoPaulo()`, faltam outras funcoes | 1-13 |

---

## Solucao

### 1. Expandir `src/lib/dateUtils.ts`

Centralizar todas as funcoes de formatacao de data com timezone explicito:

```typescript
const TIMEZONE = 'America/Sao_Paulo';

/**
 * Formata data/hora completa: "23/01/26, 17:38"
 */
export function formatDateTimeSaoPaulo(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleString('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Formata apenas hora: "17:38"
 */
export function formatTimeSaoPaulo(timestamp: number | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString('pt-BR', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Formata data curta: "23 de jan."
 */
export function formatDateShortSaoPaulo(timestamp: number | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  return date.toLocaleDateString('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
  });
}

/**
 * Formata apenas data: "23/01/2026"
 */
export function formatDateOnlySaoPaulo(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Verifica se a data e hoje (no timezone de Sao Paulo)
 */
export function isTodaySaoPaulo(date: Date): boolean {
  const today = getTodayInSaoPaulo();
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return dateStr === today;
}

/**
 * Verifica se a data e ontem (no timezone de Sao Paulo)
 */
export function isYesterdaySaoPaulo(date: Date): boolean {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatter.format(yesterday);
  const dateStr = formatter.format(date);
  
  return dateStr === yesterdayStr;
}

/**
 * Formata data com "Hoje" ou "Ontem" + hora
 */
export function formatActivityDateSaoPaulo(dateStr: string): string {
  const date = new Date(dateStr);
  const time = formatTimeSaoPaulo(date);
  
  if (isTodaySaoPaulo(date)) {
    return `Hoje, ${time}`;
  }
  
  if (isYesterdaySaoPaulo(date)) {
    return `Ontem, ${time}`;
  }
  
  return date.toLocaleDateString('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
  }) + ' as ' + time;
}

/**
 * Agrupa por data para timeline (retorna "Hoje", "Ontem" ou "23 de janeiro")
 */
export function getDateGroupLabel(date: Date): string {
  if (isTodaySaoPaulo(date)) return 'Hoje';
  if (isYesterdaySaoPaulo(date)) return 'Ontem';
  
  return date.toLocaleDateString('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'long',
  });
}
```

---

### 2. Atualizar `CRMLeadCard.tsx`

- Remover funcao local `formatDateTimeSaoPaulo`
- Importar de `@/lib/dateUtils`
- Adicionar indicador visual de timezone

```typescript
import { formatDateTimeSaoPaulo } from '@/lib/dateUtils';

// No JSX, adicionar indicador:
<div className="pt-2 border-t space-y-1 text-xs text-muted-foreground">
  <div className="flex items-center justify-between">
    <span>Criado:</span>
    <span>{formatDateTimeSaoPaulo(card.created_at)}</span>
  </div>
  <div className="flex items-center justify-between">
    <span>Atualizado:</span>
    <span>{formatDateTimeSaoPaulo(card.updated_at)}</span>
  </div>
  <div className="flex items-center gap-1.5 text-muted-foreground/70 pt-1">
    <Clock className="h-3 w-3" />
    <span>Na fase: {timeInStage}</span>
  </div>
  {/* Indicador de timezone */}
  <div className="text-[10px] text-muted-foreground/50 text-right">
    Horario de Brasilia (UTC-3)
  </div>
</div>
```

---

### 3. Atualizar `WhatsAppMessagesDialog.tsx`

- Remover funcoes locais `formatMessageTime` e `formatMessageDate`
- Importar `formatTimeSaoPaulo` e `formatDateShortSaoPaulo` de `@/lib/dateUtils`

```typescript
import { formatTimeSaoPaulo, formatDateShortSaoPaulo } from '@/lib/dateUtils';

// Substituir chamadas:
// formatMessageTime(timestamp) -> formatTimeSaoPaulo(timestamp)
// formatMessageDate(timestamp) -> formatDateShortSaoPaulo(timestamp)
```

---

### 4. Atualizar `CRMLeadDetailsDialog.tsx`

- Remover import de `format` do date-fns
- Importar `formatDateTimeSaoPaulo` de `@/lib/dateUtils`
- Substituir todas as chamadas `format(new Date(...), "dd/MM/yy, HH:mm", { locale: ptBR })`

```typescript
import { formatDateTimeSaoPaulo } from '@/lib/dateUtils';

// Linha 163:
{formatDateTimeSaoPaulo(card.created_at)}

// Linha 192:
desde {formatDateTimeSaoPaulo(card.stage_entered_at)}

// Linha 244:
{formatDateTimeSaoPaulo(item.changed_at)}
```

---

### 5. Atualizar `ActivityTimeline.tsx`

- Remover funcoes locais `formatActivityDate` e `groupActivitiesByDate`
- Importar helpers de `@/lib/dateUtils`

```typescript
import { 
  formatActivityDateSaoPaulo, 
  getDateGroupLabel,
  formatTimeSaoPaulo 
} from '@/lib/dateUtils';

// Usar formatActivityDateSaoPaulo ao inves de formatActivityDate
// Usar getDateGroupLabel ao inves da logica local de agrupamento
```

---

### 6. Atualizar `LeadsList.tsx`

- Substituir funcao local `formatDate` por import
- Adicionar timezone explicito

```typescript
import { formatDateOnlySaoPaulo } from '@/lib/dateUtils';

// Substituir formatDate(dateString) por formatDateOnlySaoPaulo(dateString)
```

---

## Resumo das Alteracoes

| Arquivo | Acao |
|---------|------|
| `src/lib/dateUtils.ts` | Adicionar 8 novas funcoes de formatacao |
| `src/pages/crm/components/CRMLeadCard.tsx` | Usar import + adicionar indicador visual |
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | Remover funcoes locais, usar imports |
| `src/pages/crm/components/CRMLeadDetailsDialog.tsx` | Substituir date-fns format por helper |
| `src/pages/crm/monitoring/components/ActivityTimeline.tsx` | Substituir funcoes locais por imports |
| `src/pages/leads/LeadsList.tsx` | Usar helper com timezone |

---

## Resultado Esperado

1. **Consistencia**: Todas as datas/horas exibidas corretamente no fuso de Brasilia
2. **Reutilizacao**: Funcoes centralizadas em `dateUtils.ts`
3. **Clareza**: Indicador visual "Horario de Brasilia (UTC-3)" nos cards
4. **Manutencao**: Alteracoes futuras em um unico arquivo

---

## Indicador Visual Proposto

Adicionar ao rodape dos cards do CRM:

```
┌─────────────────────────────────┐
│ Criado:      23/01/26, 17:38    │
│ Atualizado:  23/01/26, 17:38    │
│ 🕐 Na fase: cerca de 3 horas    │
│        Horario de Brasilia 🇧🇷   │
└─────────────────────────────────┘
```

Isso deixa claro para o usuario que os horarios mostrados sao sempre de Brasilia, independente de onde ele esteja acessando.
