# Fluxo "Chamada WA" com modal + seleção de dispositivo

## Viabilidade (após leitura da API Wavoip + código atual)

Confirmado pela docs do SDK (`webphone/primeiros-passos/inicializacao` e `webphone/referencia/api-publica`) e pelo `WavoipContext`:

- `api.call.start(digits, { displayName, fromTokens: [device_token] })` já aceita **`fromTokens`** para escolher explicitamente por qual dispositivo originar a chamada. É o único ponto de decisão real — hoje o contexto pega automaticamente o primeiro dispositivo conectado (`userDevicesRef`).
- Múltiplos dispositivos podem estar `device.add`/`device.enable` simultaneamente no webphone; o SDK só precisa saber qual usar via `fromTokens` na hora do `start`.
- O widget do webphone pode ser aberto/fechado via `wp.widget.open()/close()`. Não há efeito colateral em não abrir o widget antes — ele é aberto no `start`.

Conclusão: viável 100% com o SDK atual, sem novas edge functions nem migrations. Toda a mudança é frontend.

## O que muda

### 1) Novo componente `src/components/chat/WavoipCallDialog.tsx`
Modal (shadcn `Dialog`) exibido ao clicar em "Chamada WA". Conteúdo:

- **Cabeçalho**: "Iniciar chamada WhatsApp"
- **Dados do destinatário**: nome do contato + telefone formatado (E.164 BR).
- **Seletor de dispositivo** (`Select` shadcn): lista `userDevicesRef` filtrado por `connection_status === 'connected'`. Rótulo = `device_name` (fallback: últimos 6 do token). Default = primeiro conectado. Se só houver 1, mostra o Select desabilitado.
- **Estado vazio**: se nenhum dispositivo conectado → mensagem "Nenhum dispositivo Wavoip conectado" + link para `/wavoip`; botão Ligar desabilitado.
- **Rodapé com 2 botões circulares** (`Button` `size="icon"` `rounded-full`):
  - Vermelho (`PhoneOff`): fecha o modal sem qualquer ação de chamada.
  - Verde (`Phone`): dispara `startCall(phone, { deviceId })` e fecha o modal.

Props: `{ open, onOpenChange, phone, contactName }`.

### 2) `WavoipContext.tsx` — aceitar dispositivo explícito
Ampliar assinatura:

```ts
startCall(phoneE164: string, opts?: { displayName?: string; deviceId?: string })
```

- Se `opts.deviceId` for informado, resolve o device em `userDevicesRef` por `id`; caso contrário mantém o comportamento atual (primeiro conectado).
- `displayName` padrão continua vindo do `device_name` escolhido.
- Expor novo campo `devices` (lista já carregada em `userDevicesRef`) no contexto para o modal renderizar sem re-consulta.
- Remover a dependência do `prefillDialer` neste fluxo — o clique em "Ligar" chama diretamente `startCall`, que já abre o widget via `wp.widget.open()` no fluxo existente. `prefillDialer` continua disponível para outros pontos.

### 3) `src/components/chat/WavoipCallButton.tsx`
Substituir o `onClick` que chama `prefillDialer` por: abrir `WavoipCallDialog` com `phone` e `contactName`. Mantém validações (`hasActivePlan`, `ready`, `canDial`).

## Fora de escopo
- Nenhuma edge function nova, nenhuma migration, nenhuma alteração no `WavoipPage` ou no histórico.
- Sem mudança visual do widget do Wavoip em si.

## Arquivos afetados
- criar `src/components/chat/WavoipCallDialog.tsx`
- editar `src/components/chat/WavoipCallButton.tsx`
- editar `src/contexts/WavoipContext.tsx` (assinatura do `startCall` + expor `devices`)
