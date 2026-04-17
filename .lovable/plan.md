

## Diagnóstico

### Bug 1 — Mídias recebidas não aparecem
Confirmado no banco: 30 mensagens de mídia (imagem/vídeo/áudio/doc), **0 com `media_url`**. Causas combinadas:
1. **Webhook não decifra**: `uazapi-chat-webhook/index.ts` só copia `msg.message.imageMessage.url` (que vem como `.enc` criptografado ou ausente em payloads novos da UaZapi). Não chama `POST /message/download` para decifrar e obter `fileURL`/`base64`.
2. **Frontend não baixa sob demanda**: `ChatMessages.tsx` linha 227 instancia `<MessageBubble>` **sem passar `onDownloadMedia`**. O `MessageBubble` mostra botão "Baixar" mas a callback é `undefined` → clique não faz nada.
3. **Sem persistência**: mesmo se baixasse, não há lógica para salvar no bucket `chat-media` e atualizar `media_url` da mensagem (próximo carregamento perderia o blob).

### Bug 2 — Envio de mídia (parcial)
`sendMedia` em `WhatsAppDataContext.tsx` faz upload para `chat-media` e envia `mediaUrl` para UaZapi `/send/media`. Fluxo OK, mas:
- Áudio gravado é enviado como `audio/webm;codecs=opus` → WhatsApp não toca (espera `ogg/opus` puro). Precisa converter ou marcar mimetype `audio/ogg; codecs=opus`.
- Documento ignora mimetype no payload (UaZapi precisa de `mimetype` explícito para alguns tipos).
- `fileName` não é repassado a UaZapi como `docName` (campo esperado pela API).

---

## Correção

### A. Edge Function nova: `chat-media-download`
Centraliza decifragem + persistência no Storage. Recebe `{ messageId, queueId }`, busca credenciais da fila, chama `POST /message/download` na UaZapi com `return_link: true`, baixa o `fileURL` retornado, faz upload ao bucket `chat-media` em `{clientId}/{contactId}/{messageId}.{ext}`, atualiza `chat_messages.media_url` com a URL pública e retorna a URL.

Idempotente: se a mensagem já tem `media_url` salva (não-`.enc`), retorna direto.

### B. `MessageBubble` + `ChatMessages`
- `ChatMessages.tsx`: passar `onDownloadMedia={handleDownloadMedia}` ao `MessageBubble`. Implementar `handleDownloadMedia(messageId)` que invoca `chat-media-download` e atualiza estado local da mensagem com a URL retornada.
- `MessageBubble`: para imagens/áudio/vídeo, **disparar download automaticamente** ao montar (não exigir clique), com loading state — exatamente como WhatsApp Web. Documentos seguem com botão manual.
- Áudio/vídeo: usar tag nativa `<audio controls>` / `<video controls>` quando URL disponível (já está, mas garantir `preload="metadata"` em áudio também).
- Imagem: ao clicar, abrir lightbox fullscreen (novo componente leve com `Dialog`).
- Áudio: melhorar player — barra de progresso clicável (seek), velocidade 1x/1.5x/2x, tempo decorrido + total.

### C. `sendMedia` (envio)
- Ao gravar áudio: rotular o blob como `audio/ogg; codecs=opus` no upload (renomear extensão `.ogg`) — UaZapi/WhatsApp aceitam melhor.
- Passar `mimetype` e `docName` (= `fileName`) ao endpoint UaZapi.
- Para imagem grande (>5MB): comprimir antes do upload (canvas → jpeg q=0.85).
- Adicionar feedback visual de progresso (já existe `tempMessage` com status `sending`; garantir spinner sobre o preview).

### D. Webhook (preventivo)
Quando o payload já trouxer `fileURL` ou `base64` decifrado (UaZapi pode mandar dependendo da configuração da instância), salvar diretamente em vez de depender do download sob demanda. Manter download sob demanda como fallback.

### E. Lightbox de imagem (novo)
Componente `MediaLightbox.tsx` simples com `Dialog`, navegação prev/next entre mídias da conversa, download e zoom — padrão WhatsApp Web.

### Validação
1. Abrir conversa com mensagens de imagem → imagens carregam sozinhas (sem clicar). Clicar abre lightbox.
2. Áudios PTT recebidos → tocam com player completo (play/pause/seek/velocidade).
3. Vídeos recebidos → player nativo HTML5 funciona.
4. Documentos → botão de download abre arquivo.
5. Enviar imagem do botão de anexo → aparece imediatamente como preview, depois confirmada.
6. Gravar áudio e enviar → contato recebe áudio que toca no WhatsApp normal.
7. Enviar PDF → contato recebe com nome correto.
8. Recarregar página → mídias persistem (URL no Storage).

### Arquivos a editar/criar
- **Nova edge function**: `supabase/functions/chat-media-download/index.ts` — decifrar + persistir.
- `src/components/chat/ChatMessages.tsx` — passar `onDownloadMedia` + auto-download trigger.
- `src/components/chat/MessageBubble.tsx` — auto-download em mount para img/audio/video, melhor player de áudio, abrir lightbox.
- `src/components/chat/MediaLightbox.tsx` — **novo**, visualização fullscreen.
- `src/contexts/WhatsAppDataContext.tsx` — `downloadMedia(messageId)` invocando edge function + atualizando estado; ajustar `sendMedia` (mimetype áudio, docName).
- `src/components/chat/AudioRecorder.tsx` — rotular blob como `audio/ogg; codecs=opus` (extensão `.ogg`).
- `supabase/functions/uazapi-chat-webhook/index.ts` — capturar `fileURL`/`base64` quando vier no payload.

