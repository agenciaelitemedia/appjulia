## Problema

A mensagem do número **5584986206195** foi um **GIF animado** (que o WhatsApp transmite como `video/mp4`), mas foi salva no banco como `type='image'` com preview "📷 Imagem" — embora o `media_url` aponte para um `.mp4`. Isso quebra a renderização (o componente tenta carregar como imagem em vez de player de vídeo).

### Causa raiz (em `supabase/functions/uazapi-chat-webhook/index.ts`, função `extractMessageType`)

Payload recebido:
- `messageType: "VideoMessage"`
- `mediaType: "gif"`
- `type: "media"`
- `content.URL` presente
- `content.mimetype: "video/mp4"`

Fluxo atual:
1. `mt = "gif"` (mediaType vence sobre messageType).
2. Nenhuma das checagens `.includes('image'|'video'|...)` casa com `"gif"`.
3. Cai no fallback final (linha 349): `msg.type === 'media' && content.URL` → retorna sempre **`'image'`**. Bug.

## Plano

### 1) Corrigir `extractMessageType` (uazapi-chat-webhook)

Tornar a detecção robusta sem quebrar fluxos atuais:

- Tratar `mediaType === 'gif'` (e variantes como `'animated'`) como **`video`** — WhatsApp envia GIF como mp4 e o `messageType` já é `VideoMessage`.
- Antes do fallback "media → image", inspecionar `content.mimetype` (e `message.*.mimetype`) e mapear pelo prefixo MIME:
  - `image/*` → `image`
  - `video/*` → `video`
  - `audio/*` → `ptt` se `is_ptt`/`ptt`, senão `audio`
  - `application/*` ou outros → `document`
- Só usar o fallback "image" se realmente não houver mimetype/messageType identificável (mantém comportamento legado quando não há pistas).
- Manter a ordem das checagens atuais para casos já funcionando (image, video, ptt, audio, document, sticker, location, contact, reaction, revoked) — apenas inserir os novos ramos antes do fallback genérico.

### 2) Backfill pontual do registro afetado

Atualizar a mensagem `51d9ba91-68d4-425f-87c3-e4e2a7ff65d4` (e, via query defensiva, quaisquer outras onde `type='image'` mas o `metadata->>'mimetype'` ou `raw_payload->>'messageType'` indique vídeo) para `type='video'`, ajustando também `last_message_text` no contato quando for a última mensagem. Sem mexer em mídia já baixada.

### 3) Memória

Atualizar `mem://index.md` adicionando referência e criar `mem://technical/chat/uazapi-message-type-detection.md` documentando:
- Que `mediaType=gif` no UaZapi = vídeo mp4 (não imagem).
- Ordem de prioridade da detecção: `messageType` específico → `mediaType` → mimetype do `content` → fallback.
- Proibido o fallback cego para `image` sem inspecionar mimetype primeiro.

## Arquivos tocados

- `supabase/functions/uazapi-chat-webhook/index.ts` (apenas `extractMessageType` + helpers locais).
- Migration de backfill (ou `supabase--insert` UPDATE pontual).
- `mem://index.md` e novo arquivo de memória técnica.

## Riscos

Baixo. A mudança só adiciona ramos antes do fallback genérico atual; tipos já corretamente classificados continuam pelo mesmo caminho.