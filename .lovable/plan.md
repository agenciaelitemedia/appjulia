## Objetivo
Fazer com que os badges da Linha 3 (Fila → SLA → Responsável → CRM) pareçam **um único badge segmentado**: mesma altura, sem espaçamento entre eles, e cantos arredondados apenas nas extremidades.

## Mudanças

### 1. `src/components/chat/ChatContactItem.tsx`
- **Container**: trocar `gap-1` do wrapper interno por `gap-0` (sem espaçamento entre os segmentos). Manter `gap-1` apenas entre o grupo segmentado e o `PriorityBadge` à direita.
- **Pill (Fila / Responsável)**: aplicar altura fixa `h-5` + `inline-flex items-center` para alinhar verticalmente com SLA e CRM. Aceitar uma prop `className` extra para arredondamento condicional.
- **Fila (primeiro segmento)**: adicionar `rounded-l` (canto esquerdo arredondado).
- **Responsável (último ou penúltimo segmento)**:
  - Se **NÃO houver** badge CRM → adicionar `rounded-r` (extremidade direita).
  - Se **houver** badge CRM → manter sem arredondamento (o CRM fecha a direita).
- **CRM**: já usa `rounded-r`; manter. Ajustar altura para `h-5` para ficar idêntica aos demais. Remover `gap` de margem.
- **SLA**: passar `className` extra a `SlaBadge` para garantir `h-5` e nenhum arredondamento (segmento do meio).

### 2. `src/components/chat/SlaBadge.tsx`
- No modo `compact`, adicionar `h-5` para alinhar altura com os outros segmentos (mantém `px-1.5 py-0.5` mas com altura controlada).

## Regras finais de arredondamento (sequência possível Fila → SLA → Responsável → CRM)
- **Primeiro segmento existente** recebe `rounded-l`.
- **Último segmento existente** recebe `rounded-r`.
- Segmentos do meio: sem arredondamento.
- Para simplificar e cobrir o pedido: Fila sempre `rounded-l`; CRM sempre `rounded-r`; Responsável recebe `rounded-r` apenas quando CRM ausente.

## Resultado visual
Uma "barra" contínua: `[ FILA | SLA | RESPONSÁVEL | CRM ]`, todos com `h-5`, sem gaps, dando aparência de um único badge dividido em seções.