
## Problema
Mensagens de mídia (áudio, imagem, vídeo, documento) enviadas pela API Oficial (WABA) chegam normalmente no WhatsApp do destinatário, e ele responde — mas essas respostas/mensagens não aparecem na fila da UaZapi do nosso sistema. Já o **texto** enviado pela oficial aparece normal na UaZapi.

## Hipótese principal
O webhook `uazapi-chat-webhook` está recebendo o evento de mídia da UaZapi, mas:
- ou está descartando a mensagem porque o `text`/conteúdo vem vazio (usando o JSON cru de mídia como sentinela e caindo num `skip`),
- ou está tentando gravar `last_message_text` com o objeto de mídia e falhando silenciosamente (insert do `chat_messages`/`chat_contacts` retorna erro e o webhook responde 200),
- ou o helper recém-criado (`getMessagePreview` / sanitização) está rejeitando o payload de mídia da UaZapi e impedindo o insert.

Pelos logs (`processed=1 ... backfills=0`) o webhook está processando, mas precisamos confirmar se a linha realmente foi inserida em `chat_messages` para mídia recebida via UaZapi.

## Investigação a fazer (modo default)
1. Ler `supabase/functions/uazapi-chat-webhook/index.ts` na íntegra, focando em:
   - Como `mediaType` / `messageType` da UaZapi é mapeado para `type` interno.
   - Como `text` é extraído quando é mídia (não pode ficar vazio nem `[object Object]`).
   - Onde foi adicionada a sanitização do `last_message_text` no último ajuste — confirmar que ela não está bloqueando o insert do `chat_messages`.
2. Consultar `chat_messages` e `chat_contacts` para a conversa de teste (UaZapi) e confirmar se há registros de mídia recentes ou só de texto.
3. Conferir filtros de fila/queue: o webhook precisa estar associando a mídia ao mesmo `queue_id` do texto. Verificar se mídia não está caindo num `skipped` por falta de `chatid` válido para mídia (ex.: status/ack chegando com `mediaType` mas sem corpo).
4. Se necessário, comparar o payload de evento `messages` para texto vs. mídia da UaZapi nos logs do webhook.

## Plano de correção (alto nível)
1. **Normalização de mídia recebida (UaZapi webhook)**
   - Garantir que para `mediaType` ∈ {image, video, audio, ptt, document, sticker} o webhook:
     - mapeie corretamente para `type`,
     - extraia `media_url`, `mime_type`, `file_name`, `caption`,
     - grave `text` como **rótulo amigável** via `getMessagePreview` (e não como JSON cru nem objeto),
     - persista a linha em `chat_messages` mesmo quando `content` original vier como objeto.

2. **Sanitização defensiva no insert**
   - Antes do `insert` em `chat_messages`, forçar `text` a string segura e nunca repassar objeto.
   - Antes do `update` de `chat_contacts.last_message_text`, usar o mesmo helper.

3. **Validação de fluxo**
   - Verificar que o `queue_id` resolvido para mídia é o mesmo do texto da mesma instância UaZapi.
   - Garantir que mídia recebida cria/atualiza `chat_contacts` e dispara o realtime para a UI da fila UaZapi.

4. **Logs de diagnóstico**
   - Adicionar logs claros no webhook quando uma mensagem for descartada (motivo: sem chatid, mediaType desconhecido, insert error), para evitar “processed=1” enganoso.

5. **Teste end-to-end**
   - Enviar pela API oficial: texto, imagem, áudio, documento e vídeo para um contato cuja resposta entra pela UaZapi.
   - Confirmar que todas as respostas aparecem na fila UaZapi com preview correto.

## Arquivos prováveis
- `supabase/functions/uazapi-chat-webhook/index.ts` (principal)
- `src/lib/chat/messagePreview.ts` (reutilização do helper no servidor — duplicar a lógica em Deno se necessário)
- Possivelmente `src/components/chat/...` se houver filtro client-side escondendo mídia da UaZapi

## Resultado esperado
- Mídias recebidas pela UaZapi voltam a aparecer na fila do sistema, com preview correto (📷/🎵/📎/🎥) e `last_message_text` legível, mantendo o comportamento já correto para texto e para a API Oficial.
