## Objetivo
Tornar os botões de chamada sempre visíveis no header do chat, mesmo sem contratação, exibindo tooltip orientando o cliente a falar com o Comercial da Atende Julia.

## Mudanças

### 1. `src/components/chat/WavoipCallButton.tsx` — ZAP Call
- Remover o `if (!hasActivePlan) return null;` para o botão sempre aparecer.
- Quando `!hasActivePlan`:
  - Renderizar botão em estado desabilitado visual (`opacity-60`, cursor-not-allowed, cores neutras — sem verde).
  - `onClick`: exibir `toast.info` com a mensagem:
    > "Para habilitar o ZAP Call (módulo de ligação pelo WhatsApp), entre em contato com o Comercial da Atende Julia."
  - `title` (tooltip nativo) com o mesmo texto.
  - Não abrir o `WavoipCallDialog`.
- Comportamento atual (ready/canDial) permanece inalterado quando `hasActivePlan === true`.

### 2. `src/components/chat/ChatHeader.tsx` — VOIP Call
- Alterar o `title` do botão VOIP quando `!phoneReady` de:
  > "VOIP Call (ramal indisponível)"

  para:
  > "Para habilitar o VOIP Call (módulo de ligação via telefonia normal — celular/telefone fixo), entre em contato com o Comercial da Atende Julia."
- Manter o botão visível/clicável (o diálogo atual já lida com ausência de ramal). Sem mudança em `onClick` nem no estilo além do já existente para estado indisponível.

## Fora de escopo
- Não alterar lógica de `hasActivePlan`, `usePhone`, contexto Wavoip ou fluxos de contratação.
- Não mexer em outros pontos de uso do `WavoipCallButton`.