

## Diagnóstico

Validei o fluxo end-to-end das duas filas (UaZapi e WABA). Envios de **texto** já funcionam para ambas. Envios de **mídia** funcionam para UaZapi e — após os últimos ajustes — também para WABA, mas com gaps:

### Problemas confirmados

1. **Inbound WABA media não abre no chat**  
   `meta-webhook` salva `media_url = "waba_media:{media_id}"` (placeholder). Quando o usuário clica para baixar, o front chama `chat-media-download` → função tenta buscar credenciais UaZapi (`evo_url`/`evo_apikey`) na fila WABA, não encontra e retorna `Queue credentials not found`. Imagens/áudios/vídeos/docs recebidos via API Oficial ficam ilegíveis.

2. **PTT (áudio de voz) WABA quebrado**  
   Front envia `type: 'ptt'` para `waba-send`. O switch na função só mapeia `audio|video|document|sticker` → cai no default `image` e o upload falha (mimetype `audio/ogg` vs tipo `image`). Resultado: gravações de voz não saem pela fila Oficial.

3. **MIME com codec quebra upload no Meta**  
   Mesmo bug que tivemos no `chat-media-upload`: o Graph API `/media` também rejeita `audio/ogg;codecs=opus` no campo `type` do form-data. Precisa do mesmo `cleanMime = mimetype.split(";")[0].trim()` antes de subir.

4. **`markAsRead` não roda para WABA**  
   Hoje só executa em UaZapi. Para paridade (e para tirar o badge "lido duplo" no WhatsApp do cliente), enviar `POST /{phone_number_id}/messages {messaging_product:'whatsapp', status:'read', message_id}`.

### Fluxos que JÁ estão corretos (não tocar)
- Resolução de fila por `phone_number_id` no `meta-webhook` (corrigido em iteração anterior).
- `sendMessage` de texto em ambos os canais.
- Persistência de `chat_messages` / `chat_conversations` com `queue_id` correto.
- `chat-media-upload` com `cleanMime` (já corrigido).

## Correções

### 1. `supabase/functions/chat-media-download/index.ts` — suporte a WABA
- Detectar canal pelo `chat_messages.channel_type` ou pelo prefixo `waba_media:` em `media_url`.
- Se WABA:
  - Resolver fila por `queue_id` (ou pela conversa) e ler `waba_token`, `waba_number_id`.
  - Extrair `media_id` de `waba_media:{id}` ou de `raw_payload.{image|audio|video|document|sticker}.id`.
  - Chamar `waba-send` action `download_media` (já existe) para obter `base64` + `mimetype`.
  - Subir em `chat-media` bucket (mesmo padrão UaZapi) e gravar `media_url` público.
- Se UaZapi: comportamento atual intacto.
- Idempotente (já é): se `media_url` já é público (`/storage/v1/object/public/chat-media/`), retorna direto.

### 2. `supabase/functions/waba-send/index.ts` — robustez no `send_media`
- Sanitizar `mimetype` antes de enviar ao Meta: `cleanMime = mimetype.split(";")[0].trim()`.
- Mapear `media_type` corretamente, incluindo `ptt → audio`. Para `ptt`, o Meta só precisa do `type:'audio'` — o app reconhece como voice note pelo container ogg/opus.
- Validar `cleanMime` antes do `formData.append("type", cleanMime)`.

### 3. `supabase/functions/waba-send/index.ts` — nova action `mark_read`
- Aceita `queue_id` + `message_id` (external WABA id do `wamid`).
- POST `/{phone_number_id}/messages` com `{messaging_product:'whatsapp', status:'read', message_id}`.
- Retorna 200 mesmo em falha (best-effort, não bloqueante).

### 4. `src/contexts/WhatsAppDataContext.tsx`
- **`markAsRead`**: quando `queue.channel_type === 'waba'`, buscar último `message_id` (externo) inbound do contato e chamar `waba-send` `mark_read`.
- **`sendMedia`**: já passa `type` (incluindo `ptt`) para `waba-send` — sem mudança após o fix #2.
- Sem outras alterações no front; downloads de mídia WABA passarão a funcionar automaticamente via `downloadMedia` (que chama `chat-media-download` corrigido).

## Arquivos
- `supabase/functions/chat-media-download/index.ts` — branch WABA + chamada para `waba-send`/`download_media` + persistência no bucket.
- `supabase/functions/waba-send/index.ts` — `cleanMime`, mapeamento `ptt→audio`, action `mark_read`.
- `src/contexts/WhatsAppDataContext.tsx` — `markAsRead` para WABA.

## Validação
1. Receber imagem na fila Oficial → clicar no preview → mídia aparece (download via Graph API + bucket).
2. Receber áudio/vídeo/PDF na Oficial → idem.
3. Gravar áudio (PTT) e enviar pela Oficial → recipiente recebe como voice note.
4. Enviar imagem com caption pela Oficial → entregue com legenda.
5. Abrir conversa Oficial com mensagens não lidas → checks azuis aparecem no WhatsApp do cliente.
6. Mesmos cenários na fila UaZapi → continuam idênticos (sem regressão).

