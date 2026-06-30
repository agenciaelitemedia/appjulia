## Objetivo
Ao clicar em "Chamada WA" no header da conversa, apenas pré-carregar o número no discador Wavoip (widget aberto com o número preenchido), sem iniciar a chamada. A ligação só começa quando o usuário clicar em "Ligar" dentro do próprio discador.

## Mudanças

### 1. `src/contexts/WavoipContext.tsx`
- Adicionar nova função `prefillDialer(phoneE164, displayName?)` no contexto:
  - Garante o webphone montado (`ensureWebphone`).
  - Abre o widget (`wp.widget?.open?.()`).
  - Preenche o número no discador sem disparar a chamada. Tentar, na ordem, as APIs públicas do SDK Wavoip:
    1. `wp.dialer?.setNumber?.(digits)` / `wp.dialer?.set?.(digits)`
    2. `wp.widget?.setNumber?.(digits)`
    3. Fallback DOM: localizar o input do discador dentro do iframe/container do widget (`input[type="tel"]`, `[data-testid="dialer-input"]`, ou input dentro do container do webphone) e setar `value` + disparar `input`/`change` events para o React do SDK reagir.
  - Retornar `{ ok, error? }` igual a `startCall`.
- Expor `prefillDialer` no `WavoipContextValue` e no `value` do provider.
- Não alterar `startCall` (continua disponível para outros fluxos).

### 2. `src/components/chat/WavoipCallButton.tsx`
- Trocar a chamada `await startCall(...)` por `await prefillDialer(phone, contactName ?? undefined)`.
- Manter validações: sem telefone → toast erro; webphone não pronto → toast; sem dispositivo conectado (`canDial` false) → toast.
- Ajustar `title` do botão para "Abrir discador com número preenchido (Wavoip)".

### 3. Sem alterações em backend, edge functions, schema ou logs
A chamada real só acontece quando o usuário clica em "Ligar" no widget, então os event listeners de `call:*` em `WavoipContext` continuam capturando o log normalmente.

## Critério de aceite
- Clicar em "Chamada WA" no header do chat: widget Wavoip abre, número do lead já aparece no campo do discador, **nenhuma chamada inicia**.
- Clicar em "Ligar" dentro do widget dispara a chamada normalmente.
- Se o SDK não expuser API de preenchimento, o fallback DOM preenche o input visível.
