

# Correção: Chamada vai para "Ringing" e depois "Canceled"

## Causa raiz identificada

O fluxo Api4Com funciona assim: ao discar, a API manda o PBX ligar **primeiro para o ramal do agente** (chamada incoming no SIP). Quando o agente atende, o PBX conecta ao número destino.

Dois problemas confirmados no código:

1. **Auto-answer não funciona**: O `newRTCSession` (linha 346) só faz auto-answer se o header `X-Api4comintegratedcall: true` estiver presente. Se o PBX não envia esse header, a chamada fica tocando sem resposta até o PBX cancelar por timeout. Solução: quando o sistema **acabou de iniciar uma discagem** (`isDialing=true`), deve auto-atender qualquer chamada incoming — pois é certamente a chamada de retorno do PBX.

2. **"Canceled" é silenciado**: No `session.on('failed')` (linha 196), quando `cause === 'Canceled'`, o `onCallFailed` **não é chamado**. O widget some silenciosamente sem mostrar erro. Isso precisa ser propagado.

## Alterações

### 1. `useSipPhone.ts` — Auto-answer quando discagem ativa + propagar "Canceled"

- Aceitar novo parâmetro `isDialingRef` (ref booleano) para saber se o usuário acabou de iniciar uma discagem
- No `newRTCSession` handler para incoming: se `isDialingRef.current === true`, fazer auto-answer imediatamente (além do check do header X-Api4comintegratedcall)
- No `session.on('failed')`: remover o filtro `cause !== 'Canceled'` — sempre chamar `onCallFailedRef.current(cause)` para qualquer falha

### 2. `PhoneContext.tsx` — Passar ref de isDialing ao hook

- Criar `isDialingRef = useRef(false)` sincronizado com `isDialing`
- Passar ao `useSipPhone` para que o auto-answer funcione
- No `handleCallFailed`: tratar "Canceled" com mensagem amigável ("Chamada cancelada ou não atendida")

### 3. `SoftphoneWidget.tsx` — Exibir erro de "Canceled"

- Já funciona se `onCallFailed` for chamado corretamente (o `dialError` será setado)
- Nenhuma alteração necessária neste arquivo

## Resumo técnico do fluxo corrigido

```text
Clique "Ligar"
  → isDialing=true, isDialingRef=true
  → API POST /dialer → PBX liga para ramal do agente
  → SIP incoming call (newRTCSession)
  → isDialingRef=true? → AUTO-ANSWER imediato
  → PBX conecta ao destino → status=in-call
  
Se falhar (qualquer causa incluindo "Canceled"):
  → onCallFailed(cause) → dialError setado → widget mostra erro
```

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/telefonia/hooks/useSipPhone.ts` | Auto-answer incoming quando isDialing; propagar "Canceled" no onCallFailed |
| `src/contexts/PhoneContext.tsx` | isDialingRef sincronizado; mensagem amigável para "Canceled" |

