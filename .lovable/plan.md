

# Softphone Universal SIP via JsSIP

## Problema raiz

O sistema atual usa `sip.js` (v0.21.2) para conexão SIP. A investigação revelou que o SDK oficial da 3C+ (`3cplusv2-sdk-js`) usa **JsSIP** internamente (`jssip ^3.7.3`). As duas bibliotecas geram mensagens SIP com headers e formatos diferentes. O PBX Asterisk da 3C+ espera o formato JsSIP, causando o erro WebSocket 1006 (rejeição no handshake).

JsSIP tambem funciona perfeitamente com Api4Com e qualquer outro PBX Asterisk/FreeSWITCH, sendo a escolha mais universal.

## Solucao

Substituir `sip.js` por `jssip` como biblioteca SIP universal. Um unico hook `useSipPhone` funciona para **todos** os provedores (3C+, Api4Com, qualquer PBX com WSS).

## Arquitetura

```text
PhoneContext
  └── useSipPhone (JsSIP) ← universal, provider-agnostic
       ├── Api4Com: wss://pbx.api4com.com:8089/ws
       ├── 3C+:    wss://pbx01.3c.fluxoti.com:8089/ws
       └── Outro:  qualquer wss://...
```

Nao ha mais fluxo separado para 3C+ (popup/iframe). Tudo via SIP nativo no browser.

## Plano de implementacao

### 1. Substituir sip.js por jssip no package.json
- Remover `sip.js` (0.21.2)
- Adicionar `jssip` (^3.10.0 ou mais recente)

### 2. Reescrever `useSipPhone.ts` com JsSIP
O hook mantem a mesma interface publica (`SipStatus`, `connect`, `call`, `answer`, `hangup`, `toggleMute`, `toggleHold`, `sendDTMF`, `diagnostics`).

Mudancas internas:
- `JsSIP.WebSocketInterface` para transporte (em vez de `UserAgent` do sip.js)
- `JsSIP.UA` para registro e gerenciamento de sessoes
- `RTCSession` events (`progress`, `accepted`, `ended`, `failed`, `peerconnection`) para controle de chamada
- DTMF via `session.sendDTMF()` com suporte RFC2833 e SIP INFO
- Hold/Unhold via `session.hold()` / `session.unhold()` (nativo no JsSIP, diferente do hack manual atual)
- Audio remoto via evento `peerconnection` + `addstream`/`track`
- Debug mode: `JsSIP.debug.enable('JsSIP:*')` condicional

Configuracao critica do UA:
```typescript
const socket = new JsSIP.WebSocketInterface(creds.wsUrl);
const config = {
  sockets: [socket],
  uri: `sip:${creds.username}@${creds.domain}`,
  password: creds.password,
  register: true,
  register_expires: 600,
  session_timers: false,
  connection_recovery_min_interval: 2,
  connection_recovery_max_interval: 30,
};
```

### 3. Restaurar DiscadorTab unificado
- Remover o branch `if (provider === '3cplus')` que renderiza `ThreeCPlusWebphone`
- Usar o mesmo `DiscadorPad` + diagnostico SIP para todos os provedores
- Remover ou deprecar `ThreeCPlusWebphone.tsx`

### 4. Restaurar PhoneContext para 3C+ via SIP
- Remover os guards `if (provider === '3cplus') return;` em `connectSip` e auto-retry
- Manter a action `get_sip_credentials` do `threecplus-proxy` (ja funciona, retorna domain/username/password/wsUrl)
- 3C+ passa a usar o mesmo fluxo SIP que Api4Com

### 5. Auto-answer para chamadas integradas
- Api4Com usa header `X-Api4comintegratedcall`
- 3C+ pode usar headers similares
- Manter logica de auto-answer por header no `onInvite`

## Vantagens do JsSIP sobre SIP.js

| Feature | sip.js | JsSIP |
|---|---|---|
| Hold/Unhold | Manual (hack RTP) | Nativo `hold()`/`unhold()` |
| DTMF | Apenas RFC2833 | RFC2833 + SIP INFO |
| Reconexao WS | Manual | Built-in recovery |
| Compatibilidade Asterisk | Boa | Excelente (padrao de facto) |
| Usado pelo 3C+ | Nao | Sim (SDK oficial) |
| Tamanho | ~150KB | ~50KB |

## Arquivos alterados

| Arquivo | Mudanca |
|---|---|
| `package.json` | Trocar `sip.js` por `jssip` |
| `src/pages/telefonia/hooks/useSipPhone.ts` | Reescrita completa com JsSIP |
| `src/pages/telefonia/components/DiscadorTab.tsx` | Remover branch 3C+ popup |
| `src/contexts/PhoneContext.tsx` | Remover guards `3cplus` do SIP |
| `src/pages/telefonia/components/ThreeCPlusWebphone.tsx` | Remover (nao mais necessario) |

## Resultado esperado

- Softphone SIP nativo funciona para 3C+ e Api4Com identicamente
- Sem janela separada, tudo inline no sistema
- Hold, mute, DTMF, reconexao automatica funcionam nativamente
- O erro WebSocket 1006 desaparece porque JsSIP e a biblioteca que o PBX 3C+ espera

