## Problema

Mensagens vindas da fila da **API oficial (WABA)** não exibem imagem, vídeo, áudio nem sticker. A UaZapi continua funcionando.

### Causa raiz

Quando o `meta-webhook` recebe uma mensagem de mídia, ele grava um placeholder em `chat_messages.media_url` no formato:

```
waba_media:<MEDIA_ID>
```

Esse placeholder precisa ser resolvido depois via `chat-media-download` → `waba-send action=download_media`, que baixa o binário da Graph API e sobe para o bucket `chat-media` (o backend já está pronto e funcionando).

O problema está no **frontend**. Em `src/components/chat/MessageBubble.tsx` a função que decide se a URL ainda é "não usável" é:

```ts
const isEncrypted = (u?: string) => !u || u.includes('.enc') || u.includes('mmg.whatsapp.net');
```

Ela cobre os casos UaZapi (`.enc`, `mmg.whatsapp.net`) mas **não reconhece** o prefixo `waba_media:`. Consequência:

- `isEncrypted("waba_media:123")` → `false`
- `usable` fica `true`
- O componente renderiza `<img src="waba_media:123">` / `<video src="waba_media:...">` / `<audio src="waba_media:...">`, que quebram silenciosamente.
- O efeito de auto-download (`useEffect` em `message.id`) também vê a URL como já usável e nunca chama `onDownload`, portanto a WABA nunca é resolvida.

## Correção

Alteração cirúrgica em **`src/components/chat/MessageBubble.tsx`**, apenas na função `isEncrypted` dentro de `MediaContent`:

```ts
const isEncrypted = (u?: string) =>
  !u ||
  u.startsWith('waba_media:') ||
  u.includes('.enc') ||
  u.includes('mmg.whatsapp.net');
```

Com isso:

1. Mensagens WABA com `media_url = "waba_media:<id>"` passam a ser tratadas como "ainda não baixadas".
2. O `useEffect` de auto-download dispara `onDownload()` → `chat-media-download` → resolve o id via `waba-send` → grava a URL pública do bucket em `chat_messages.media_url` → o bubble atualiza via prop e renderiza a mídia.
3. Vale para todos os tipos que já entram no `autoTypes`: `image`, `video`, `audio`, `ptt`, `sticker`. Documentos continuam com botão manual "Baixar" (comportamento atual preservado).
4. **UaZapi continua idêntica**: os checks `.enc` e `mmg.whatsapp.net` permanecem intactos; nada muda no fluxo já testado.

## Fora de escopo (não vamos mexer agora)

- `chat-media-download` / `waba-send` / `meta-webhook`: já estão corretos.
- `MediaLightbox` / `MediaPreviewDialog`: recebem a URL já resolvida via prop, herdam o fix automaticamente.
- Backfill de mensagens WABA antigas: opcional, pode vir depois se o usuário pedir.

## Arquivos alterados

- `src/components/chat/MessageBubble.tsx` — 1 linha (função `isEncrypted`).
