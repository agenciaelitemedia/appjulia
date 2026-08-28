# Última mensagem (10:38) do lead 553488860163 — por que aparece vazia

## Diagnóstico confirmado nos dados

A mensagem existe no banco (13:38 UTC = 10:38 BRT), mas chegou da Meta como **tipo `unsupported`**, sem texto e sem mídia. O payload cru gravado é literalmente:

```text
type: "unsupported"
unsupported: { raw_type: "unknown", type: "unknown" }
errors: [ 131060 — "This message is unavailable." ]
```

Ou seja: a própria Meta não entregou o conteúdo. O lead enviou algo que a Cloud API não suporta / não conseguiu resolver (enquete, mensagem de visualização única, tipo novo do app, ou conteúdo expirado). Não é bug de fila, de webhook ou de permissão — e **não há conteúdo para recuperar**, porque a Meta não fornece.

O efeito visível no chat: o `MessageBubble` recebe `type: "unsupported"` (não tratado), com `text` nulo e sem mídia, então renderiza uma bolha vazia — só o horário 10:38.

Importante: isso é diferente do caso do link do Google (mensagem de saída nunca registrada). Aqui é mensagem de entrada, registrada, mas sem conteúdo do lado da Meta.

## Correção proposta (só apresentação)

Tratar `unsupported` no `MessageBubble`, no mesmo padrão já usado para `revoked`:

- bolha discreta em itálico: “⚠️ Mensagem não suportada pelo WhatsApp Oficial — conteúdo não disponível”;
- quando o payload traz `errors[0].error_data.details`, mostrar como tooltip/legenda secundária;
- mantém horário e status normais, sem alterar UaZapi nem os outros tipos.

Complemento no preview da lista de conversas: em vez de última mensagem em branco, exibir “Mensagem não suportada”.

## Detalhes técnicos

- `src/modules/julia-chat/chat/components/MessageBubble.tsx` (~linha 540, junto ao bloco `revoked`).
- `src/lib/chat/messagePreview.ts` para o texto do preview na lista.
- `src/types/chat.ts`: acrescentar `'unsupported'` ao union `MessageType`.
- Nada muda no `meta-webhook` — ele já grava corretamente o que a Meta enviou, incluindo `raw_payload`.

## Validação

1. Abrir a conversa do lead 553488860163 e confirmar que a mensagem de 10:38 mostra o aviso em vez de bolha vazia.
2. Conferir que mensagens normais (texto, imagem, áudio, vídeo, sticker) de WABA e UaZapi seguem iguais.
