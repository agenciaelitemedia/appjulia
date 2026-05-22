## Causa-raiz identificada

Nos logs do webhook aparece:

```
Event: [object Object] (isMessageUpsert=false), queue: MKT Natal
```

Ou seja, quando a UaZapi envia o evento `messages_update`, o campo `payload.event` chega como **objeto**, não como string. Hoje o código faz:

```ts
const rawEvent = payload.event || 'messages';
const event = EVENT_ALIAS[rawEvent] || rawEvent;
```

- `EVENT_ALIAS[<objeto>]` é `undefined`
- `event` continua sendo o objeto
- não bate em `messages.update` nem em `messages.upsert`
- a função sai sem atualizar o status → mensagem fica para sempre em 1 check

Isso explica perfeitamente:
- Por que adicionar `messages_update` na lista de eventos não resolveu (ele está chegando, só não é reconhecido).
- Por que só a fila MKT Natal (que mandou pro 5534988860163) ficou travada em `sent`.

## Plano de correção

### 1. Normalizar `payload.event` quando vier como objeto
No `uazapi-chat-webhook/index.ts`, extrair o nome do evento de forma resiliente:
- se `payload.event` for string → usa direto
- se for objeto → tenta `event.type`, `event.name`, `event.event`, ou a primeira chave do objeto
- se ainda não der string → fallback para `payload.EventType` / `payload.type` / `'messages'`

### 2. Log de diagnóstico do payload bruto
Logar `typeof payload.event`, as chaves quando for objeto, e o evento final resolvido. Assim a gente confirma o formato da UaZapi e nunca mais perde evento silenciosamente.

### 3. Garantir que o alias inclui todas as variações
Manter `messages_update`, `message_update`, `messages.update`, `message-update` no `EVENT_ALIAS` para cobrir todos os formatos.

### 4. Validação ponta a ponta
1. Reenviar mensagem para 5534988860163
2. Conferir nos logs: `Event: messages.update (isMessageUpsert=false)`
3. Conferir log novo `messages.update STATUS { status: 'delivered', affected: 1 }`
4. Conferir bubble passando de 1 → 2 checks → 2 checks destacados

## Detalhes técnicos

Arquivo único a alterar: `supabase/functions/uazapi-chat-webhook/index.ts`

Trecho equivalente ao novo parser:

```ts
function resolveEventName(payload: any): string {
  const raw = payload?.event ?? payload?.EventType ?? payload?.type;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    return raw.type || raw.name || raw.event || Object.keys(raw)[0] || 'messages';
  }
  return 'messages';
}
```

Sem alterações no frontend, no realtime ou no banco — o tratamento de status (`mapStatus`, guard anti-downgrade, `collectMessageIds`) já está correto, só não estava sendo executado por causa do parsing do evento.
