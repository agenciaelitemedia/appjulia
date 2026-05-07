## Problema

O softphone está iniciando ligações sem o usuário clicar em "Ligar". Após análise do código, identifiquei **2 caminhos possíveis** que causam o disparo:

### Causa 1 — Auto-answer global de chamadas entrantes (mais provável)

Em `src/pages/telefonia/hooks/useSipPhone.ts` (linhas 391-412), toda chamada SIP **entrante** é atendida automaticamente quando:

- `isDialingRef.current === true` (callback do PBX), **OU**
- O header SIP `X-Api4comintegratedcall: true` está presente

Como o usuário está em `/chat` (sem ter clicado em ligar) e o SIP fica registrado em background, qualquer chamada que chegue ao ramal com esse header — inclusive de campanhas, fila ou teste do PBX — atende sozinha. Para o usuário, parece que "disparou ligação sem clicar".

### Causa 2 — `retryDial` exposto no contexto

`PhoneContext` mantém `lastDialArgs` em ref e expõe `retryDial()`, que re-executa a última discagem. Se houver re-render/efeito que dispare `retryDial`, o sistema disca sozinho. Hoje só é chamado pelo botão "Tentar novamente" do `SoftphoneWidget`, mas se `dialError` reaparecer e o widget re-renderizar com `autoFocus`/effect, pode disparar.

---

## Plano de correção

### 1. Restringir auto-answer (causa principal)

Em `src/pages/telefonia/hooks/useSipPhone.ts`:

- **Adicionar janela temporal** para o auto-answer baseado em `isDialingRef`: só auto-atender se a chamada chegar dentro de **60s após o início do dial** (guardar `dialStartedAt` em ref no `dialNumber` do `PhoneContext` e expor para o hook).
- **Logar (com `addDiagEvent`)** o motivo do auto-answer e o `from` da chamada, para rastrear quem está disparando.
- **Bloquear auto-answer** quando `status === 'idle'` e não há dial ativo (defensivo).

### 2. Confirmar nenhum efeito chama `retryDial`/`dialNumber` automaticamente

- Auditar `SoftphoneWidget` e demais consumidores para garantir que `onRetry`/`dialNumber` só rodam por interação do usuário (sem `useEffect` disparando).

### 3. Adicionar painel de diagnóstico

- No softphone widget, mostrar quando uma chamada foi auto-atendida e por qual regra (já temos `addDiagEvent`, basta destacar visualmente).
- Expor toast informativo quando o auto-answer disparar para o usuário entender o que aconteceu.

### 4. Validação

- Pedir ao usuário para reproduzir e enviar o **último evento do diagnóstico SIP** (Telefonia → Discador → Diagnóstico SIP) na hora do disparo. Isso confirma se foi callback PBX, header integrated ou outra causa.

---

## Arquivos afetados

- `src/pages/telefonia/hooks/useSipPhone.ts` — lógica de auto-answer
- `src/contexts/PhoneContext.tsx` — expor `dialStartedAt` ref
- `src/pages/telefonia/components/SoftphoneWidget.tsx` — auditar handlers
