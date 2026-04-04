

# Correção: Cancelamento + Feedback Correto de Erro/Sucesso

## Problemas confirmados no código

1. **Toast "sucesso" falso** (PhoneContext.tsx:231): `toast.success("Ligando para...")` dispara quando a API responde OK, mas a chamada SIP ainda não conectou. Se o SIP falhar depois, o usuário já viu mensagem de sucesso.

2. **Sem botão cancelar durante discagem** (SoftphoneWidget.tsx:108-124): O estado `isDialing` renderiza animação mas nenhum botão de cancelar. O botão X no header está escondido quando `isDialing` (linha 279).

3. **Falha SIP não propagada**: `useSipPhone` chama `cleanupSession()` no evento `session.on('failed')`, que reseta status para `registered`, mas não avisa o PhoneContext. O `dialError` nunca é setado para falhas SIP.

4. **Sem função `cancelDial`**: Não existe forma de cancelar uma discagem em andamento.

## Alterações

### 1. `useSipPhone.ts` — Novo callback `onCallFailed`

- Aceitar parâmetro opcional `onCallFailed?: (cause: string) => void`
- No evento `session.on('failed')`, chamar `onCallFailed(cause)` antes de `cleanupSession()`
- Permite que PhoneContext capture falhas SIP

### 2. `PhoneContext.tsx` — Corrigir toast + cancelar + capturar falha SIP

- **Trocar** `toast.success(...)` por `toast.info("Discando...")` (linha 231)
- **Passar** callback `onCallFailed` ao `useSipPhone` que seta `setDialError(causa)` e `setIsDialing(false)`
- **Nova função** `cancelDial()`: chama `sip.hangup()`, reseta `isDialing`, `dialError`, fecha softphone
- **Expor** `cancelDial` no contexto

### 3. `SoftphoneWidget.tsx` — Botão cancelar visível

- No `renderDialingState()`: adicionar botão "Cancelar" vermelho abaixo da animação
- No `renderCallingState()`: já tem botão desligar (OK)
- No header (linha 279): mostrar botão X/Cancelar durante `isDialing` (remover `!isDialing` da condição)
- Nova prop `onCancel` para chamar `cancelDial`

### 4. `MainLayout.tsx` — Passar `cancelDial`

- Importar `cancelDial` do contexto e passar como `onCancel` ao `SoftphoneWidget`

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/telefonia/hooks/useSipPhone.ts` | Novo callback `onCallFailed` no `session.on('failed')` |
| `src/contexts/PhoneContext.tsx` | `toast.info` em vez de `toast.success`; captura falha SIP; nova `cancelDial` |
| `src/pages/telefonia/components/SoftphoneWidget.tsx` | Botão cancelar no estado dialing; prop `onCancel`; header X visível |
| `src/components/layout/MainLayout.tsx` | Passar `cancelDial` como `onCancel` |

