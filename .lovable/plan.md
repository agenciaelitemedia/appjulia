## Problema

Sim — hoje a IA Julia está sendo desligada quando ela mesma envia uma mensagem via UaZapi.

No `uazapi-chat-webhook/index.ts` (linha 1740), a regra dispara `disableJuliaOnHumanSend` para **qualquer** `fromMe=true` em chat direto. O helper só ignora se receber `messageSource` em `['bot','campaign','autoreply','ai']`, mas o webhook **não passa** `messageSource` (diferente do `waba-send`, que passa `args.source`).

Resultado: quando Julia envia uma resposta pelo UaZapi, o webhook recebe o echo `fromMe=true` e desativa a sessão dela mesma.

## Correção

Detectar mensagens da própria Julia consultando `chat_messages.metadata->>source` antes de chamar o helper. As mensagens enviadas pela IA são persistidas pelo path de envio (uazapi-send / bot) com `metadata.source` em `bot|ai|autoreply|campaign`. Quando o echo chega no webhook como duplicado, a row já existe com esse source.

**Arquivo:** `supabase/functions/uazapi-chat-webhook/index.ts` (bloco linha 1737-1749)

Alterar para, antes do `waitUntil`, buscar o source da mensagem por `external_id` (msg.id) na conversation atual e só disparar o helper se source não estiver em `('bot','ai','autoreply','campaign')`. Se `insertedMsg?.id` existir e for um insert novo sem source bot, é mensagem humana (WhatsApp Web/App ou echo de UI sem marca → tratado como humano). Se row já existe (duplicate) com source automatizado → no-op.

```ts
if (fromMe && !isGroup && senderPhone) {
  const { data: existing } = await supabase
    .from('chat_messages')
    .select('metadata')
    .eq('conversation_id', conversationId)
    .eq('external_id', msg.id)
    .maybeSingle();
  const source = (existing?.metadata as any)?.source as string | undefined;
  EdgeRuntime.waitUntil(
    disableJuliaOnHumanSend({
      clientId: queue.client_id,
      queueId: queue.id,
      contactPhone: senderPhone,
      messageSource: source ?? null,
    }),
  );
}
```

O helper já trata `messageSource` automatizado como no-op, então Julia não desliga a si mesma; mensagens humanas (sem source ou source manual) continuam desligando como esperado.

## Verificação

Após deploy: enviar mensagem pela IA Julia e confirmar que `agent_session.active` permanece `true`; enviar pelo WhatsApp Web/App e confirmar que vai para `false`.