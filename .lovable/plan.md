## Objetivo
1. No `Header`, reordenar os badges: **VOIP Call antes de ZAP Call** (VOIP à esquerda).
2. Ao clicar no badge ZAP Call quando disponível, abrir modal para escolher dispositivo + digitar número. Ao confirmar, dispara `startCall` (que abre o webphone Wavoip já discando com o dispositivo escolhido).

## Alterações

### 1. `src/components/layout/Header.tsx`
- Trocar a ordem para `<HeaderDialer />` (VOIP) antes de `<HeaderZapCallBadge />` (ZAP).

### 2. Novo `src/components/layout/HeaderZapDialerDialog.tsx`
- Dialog reutilizando o padrão visual do `WavoipCallDialog`.
- Props: `open`, `onOpenChange`.
- Consome `useWavoip()` → `devices`, `startCall`.
- Lista `connected = devices.filter(d => d.connection_status === 'connected')`.
- Campo `Input` para número (máscara via `maskPhone`, mantém somente dígitos internamente).
- `Select` de dispositivo (mesmo `deviceLabel` do `WavoipCallDialog`). Auto-seleciona quando houver apenas 1 conectado.
- Se `connected.length === 0`: mensagem "Nenhum dispositivo Wavoip conectado" com link para `/wavoip`.
- Botões redondos: cancelar (vermelho) e ligar (verde). "Ligar" desabilitado até ter `deviceId` + número (mín. 8 dígitos).
- `handleCall`: `await startCall(digitsOnly, { deviceId })`. Sucesso → fecha modal (o SDK abre o discador). Erro → `toast.error`.

### 3. `src/components/layout/HeaderZapCallBadge.tsx`
- Adicionar estado `showDialer`.
- No `onClick`: se `!available` abre `UpsellCallDialog` (comportamento atual); se `available` abre `HeaderZapDialerDialog`.
- Remover `cursor-default` do estilo disponível — passa a ser `cursor-pointer`.
- Renderizar `<HeaderZapDialerDialog open={showDialer} onOpenChange={setShowDialer} />`.

## Fora de escopo
- `WavoipContext`, `WavoipCallDialog`, `HeaderDialer` (VOIP), `UpsellCallDialog` — sem alterações.
- Sem histórico de números, sem fila/queue vinculada (é um discador global manual).
