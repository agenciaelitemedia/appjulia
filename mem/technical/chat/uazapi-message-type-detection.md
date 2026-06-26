---
name: UaZapi Message Type Detection
description: Regras de mapeamento de messageType/mediaType/mimetype no webhook UaZapi, incluindo GIF e PTV como vídeo
type: technical
---

# Detecção de tipo de mensagem (uazapi-chat-webhook)

Função: `extractMessageType` em `supabase/functions/uazapi-chat-webhook/index.ts`.

## Ordem de prioridade

1. `mediaType === 'gif'` ou contém `'animated'` → **video** (WhatsApp entrega GIF como `video/mp4` com `messageType=VideoMessage`).
2. Substring em `mediaType || messageType || type`: image, video, ptt, audio, document, sticker, location, contact, reaction, revoked/protocol.
3. Fallback por mimetype (`content.mimetype` ou `message.*.mimetype`):
   - `video/*` → video (cobre `PtvMessage`, GIFs sem messageType, etc.)
   - `image/*` → image
   - `audio/*` → ptt se `isPtt/ptt`, senão audio
   - `application/*` ou `text/*` → document
4. Último recurso: `type === 'media'` com `content.URL` → image.

## Anti-padrão (não fazer)

- Cair direto no fallback "media → image" sem antes inspecionar `mediaType=gif/ptv` e mimetype. Isso classificava GIFs e PTVs como imagem, quebrando a renderização (player de vídeo não carregava).

## Backfill

Mensagens já gravadas com `type='image'` quando `raw_payload->>'messageType' IN ('VideoMessage','PtvMessage')` ou `mediaType IN ('gif','animated','ptv')` ou `metadata->>'mimetype' LIKE 'video/%'` devem ser corrigidas para `type='video'`, trocando o preview `📷 Imagem` por `🎥 Vídeo`.