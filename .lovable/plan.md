## Objetivo
Corrigir o alinhamento vertical dos badges segmentados (Fila → SLA → Responsável → CRM) na lista de conversas, garantindo:
- **Altura idêntica e fixa** (`h-5`) em todos os segmentos, perfeitamente alinhados topo/base.
- **Largura fixa por segmento** (não flexível) para que o conjunto nunca encoste ou chegue perto do ícone de Prioridade à direita.
- **Truncamento (`...`)** quando o texto interno (Fila ou Responsável) ultrapassar a largura do segmento.

## Larguras fixas por segmento
- **Fila**: `w-[90px]` (texto truncado se exceder).
- **SLA (compact)**: `w-[64px]` (largura suficiente para "30m", "2h", "5d" + ícone).
- **Responsável**: `w-[110px]` (texto truncado se exceder).
- **CRM**: `w-[44px]` (ícone Kanban + "CRM", sem truncamento — texto curto).

Total máximo do conjunto: ~308px. Reserva-se folga à direita (`mr-2`) antes do `PriorityBadge` para garantir respiro visual e nunca colidir.

## Mudanças

### 1. `src/components/chat/ChatContactItem.tsx`

**Refatorar `Pill`** para suportar truncamento interno e altura fixa com alinhamento por baseline:
```tsx
function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn(
      'inline-flex items-center justify-start h-5 px-1.5 text-[9px] font-bold leading-none overflow-hidden whitespace-nowrap',
      className
    )}>
      <span className="truncate">{label}</span>
    </span>
  );
}
```

**Container da Linha 3** (segmentos):
- Trocar `flex items-center gap-0 flex-1 min-w-0 overflow-hidden` por `flex items-stretch gap-0 flex-shrink-0` (sem flex-1, sem min-w-0 — larguras fixas).
- Remover wrappers `<span class="flex-shrink ... max-w-[110px] truncate">` em volta de `Pill` (Fila e Responsável) — o truncamento agora é interno no `Pill`.
- Adicionar `mr-2` ou usar `gap-2` entre o conjunto segmentado e o `PriorityBadge` (`ml-auto` no Priority continua, mas garantir respiro).

**Aplicação por segmento:**
- **Fila**: `<Pill label={queueName.toUpperCase()} className="bg-blue-600 text-white rounded-l w-[90px]" />`
- **SLA**: passar `className="w-[64px] justify-center"` ao `<SlaBadge compact />`.
- **Responsável**: `<Pill label={...} className={cn('bg-muted text-foreground w-[110px]', !hasCrmCard && 'rounded-r')} />`
- **CRM**: largura fixa `w-[44px]`, altura `h-5`, `rounded-r`, `justify-center`:
  ```tsx
  <span className="inline-flex items-center justify-center gap-0.5 h-5 w-[44px] px-1 text-[9px] font-bold rounded-r bg-blue-50 text-blue-700 whitespace-nowrap leading-none">
    <Kanban className="h-2.5 w-2.5" /> CRM
  </span>
  ```

### 2. `src/components/chat/SlaBadge.tsx`
No modo `compact`:
- Altura fixa: `h-5`.
- Adicionar `leading-none`, `whitespace-nowrap`, `overflow-hidden`.
- Permitir `className` externa controlar largura/justify (já existe a prop `className`).
- Garantir `inline-flex items-center` (já tem).

```tsx
<span className={cn(
  'inline-flex items-center justify-center gap-1 h-5 px-1.5 text-[9px] font-bold leading-none whitespace-nowrap overflow-hidden',
  s.bg,
  className
)} title={...}>
  <Icon className="h-2.5 w-2.5 flex-shrink-0" />
  <span className="truncate">{formatRemaining(evaluation.remainingMinutes)}</span>
</span>
```

## Regras de alinhamento (críticas)
- **Todos** os segmentos: `h-5` + `leading-none` + `inline-flex items-center` → garante topo/base alinhados pixel-perfect.
- **Sem `py-*`** nos segmentos (a altura é controlada por `h-5`, padding vertical quebra o alinhamento).
- **Largura fixa** em todos: nada de `flex-1`, `min-w-0` ou `max-w-` flexíveis no container da linha — o conjunto tem largura previsível e o `PriorityBadge` permanece com folga garantida à direita via `ml-auto` + `mr-2` no conjunto.

## Resultado visual
`[ FILA-90px | SLA-64px | RESPONSÁVEL-110px | CRM-44px ]` — barra única, altura `h-5` em todos, textos longos truncados com `…`, e folga mínima de 8px antes do badge de Prioridade.