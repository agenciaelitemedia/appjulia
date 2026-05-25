## Problema

Mensagens recebidas que são respostas (quoted) ou encaminhadas não exibem o vínculo com a mensagem original no chat — somente as mensagens enviadas mostram esse bloco corretamente.

## Causa

O webhook `uazapi-chat-webhook` extrai `contextInfo` apenas no formato Baileys aninhado (`msg.message.extendedTextMessage.contextInfo`, `imageMessage.contextInfo`, etc.).

Mas a uazapi.com envia o payload **flat**, com o `contextInfo` dentro de `msg.content.contextInfo` (quando `content` é objeto, casos de mídia ou texto estendido). Exemplo real do banco:

```
msg.content = {
  text: "Boom dia",
  contextInfo: {
    stanzaID: "3EB04483CC0639AC3C4E62",
    quotedMessage: { conversation: "Olá, bom dia! ..." },
    ...
  }
}
```

Como o `ctxInfo` resolve para `null`, `embeddedQuotedText` e `embeddedQuotedType` ficam nulos. O `quotedId` até é gravado em `reply_to` (vindo de `msg.quoted`), mas o `metadata.quoted_message` só é populado pelo fallback embutido — que nunca dispara. Resultado: a UI (`QuotedMessage`) não tem dados para renderizar.

Forwarded segue o mesmo padrão: a flag pode vir em `msg.content.contextInfo.isForwarded` / `forwardingScore` e não está sendo lida.

## Correção

Em `supabase/functions/uazapi-chat-webhook/index.ts`, ampliar a resolução de `ctxInfo` para incluir o formato flat da uazapi:

1. Adicionar `msg.content?.contextInfo` na cadeia de fallback do `ctxInfo` (antes do `msg.contextInfo`).
2. Manter `msg.quoted` como fonte primária de `quotedId` (já está correto).
3. Garantir que `embeddedQuotedText` cubra:
   - `qm.conversation`
   - `qm.extendedTextMessage?.text`
   - `qm.imageMessage?.caption`
   - `qm.videoMessage?.caption`
   - `qm.documentMessage?.caption`
4. `embeddedQuotedType` continua deduzindo image/video/audio/document/text a partir das chaves de `qm`.
5. `is_forwarded` e `forwarded_score` passam a considerar também `msg.content?.contextInfo?.isForwarded` e `forwardingScore`.

Nenhuma mudança de schema; nenhuma mudança no frontend (já renderiza via `metadata.quoted_message` em `QuotedMessage.tsx`).

## Validação

- Deploy da edge function.
- Enviar uma resposta no WhatsApp para uma mensagem nossa e verificar que o card cita a mensagem original (igual ao print enviado).
- Encaminhar uma mensagem para o número e verificar a marcação de encaminhada.
