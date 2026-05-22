# Plano de mudanças no Chat

## 1. Marcar mensagens recebidas como lidas (apenas visual, 2 checks azuis)

**Sem chamada externa** — não dispara markRead na UaZapi/WABA. Apenas efeito visual no nosso chat.

**Onde:** `src/components/chat/MessageBubble.tsx`

- No `StatusIcon`, hoje só renderiza ícone quando `from_me=true`. Vamos manter o comportamento atual para enviadas e adicionar render de `CheckCheck` azul (`text-sky-500`) também para mensagens recebidas (`from_me=false`), independente de `status`.
- Alternativa mais limpa: no `MessageBubble`, na linha de meta (timestamp), exibir o duplo check azul como elemento decorativo quando `!from_me`.
- Nenhuma alteração no banco, no webhook ou no `markAsRead` do contexto.

## 2. Parâmetros corretos de `replyid` e `forward`

**Arquivo:** `src/contexts/WhatsAppDataContext.tsx` + `src/lib/uazapi/types.ts`

a) `sendMessage(contactId, text, replyToMessage?, options?)`
- Renomear payload UaZapi de `quotedMessageId` → **`replyid`** (linha ~1426).
- Adicionar parâmetro opcional `options?: { forward?: boolean }`. Quando `forward=true`, incluir `forward: true` no body do `/send/text`.
- Atualizar tipos em `ChatContextValue` e `SendTextRequest`.

b) `sendMedia(contactId, file, type, caption?, options?)`
- Aceitar `replyid` e `forward` no payload do `/send/media` (para encaminhar mídia).

c) `src/components/chat/ForwardDialog.tsx`
- Quando origem for mídia com `media_url`, chamar `sendMedia` com `forward: true`.
- Quando origem for texto, chamar `sendMessage(id, message.text ?? caption ?? '', undefined, { forward: true })`.

## 3. Vídeo abre em popup (lightbox) com download

**Arquivos:** `src/components/chat/MediaLightbox.tsx` (estender) + `MessageBubble.tsx`

- Adicionar prop `kind: 'image' | 'video'` (default `image`) ao `MediaLightbox`. Quando `video`, renderizar `<video controls autoPlay>` no lugar de `<img>` (mantendo toolbar de download/fechar; remover botões de zoom).
- Em `MessageBubble.tsx` (case `'video'`): substituir o `<video controls>` inline por um thumbnail clicável (`<video preload="metadata">` sem controls + overlay com ícone `Play`). Ao clicar, abrir `MediaLightbox` com `kind="video"`, `url=mediaUrl`, `fileName`. O botão de download flutuante atual é mantido.

## 4. Modal de envio de mídia só fecha pelo botão Cancelar / após sucesso

**Arquivo:** `src/components/chat/MediaPreviewDialog.tsx`

- Remover auto-close via `onOpenChange` (passar `onOpenChange={() => {}}`).
- No `<DialogContent>`:
  - `onPointerDownOutside={(e) => e.preventDefault()}`
  - `onEscapeKeyDown={(e) => e.preventDefault()}`
  - `onInteractOutside={(e) => e.preventDefault()}`
- Ocultar o "X" padrão do `DialogContent` (classe utilitária `[&>button.absolute]:hidden`).
- Botão **Cancelar** sempre habilitado: aborta envio em andamento (limpa `pendingMedia` via `onCancel` em `ChatInput`).
- Auto-close ao sucesso já ocorre via `setPendingMedia(null)` em `ChatInput.confirmSendMedia` — mantido.

## Riscos & validação

- `replyid`: precisa ser o stanza id real (`message_id` ou `external_id`) — código já tenta ambos, só renomear a chave.
- Lightbox de vídeo: testar autoplay (browsers podem exigir `muted`); manter `controls` para destravar áudio.
- Modal travado: em caso de erro de envio (`status=failed`), `sending` volta a `false` no `finally`, então Cancelar continua funcional.

## Arquivos afetados

- `src/components/chat/MessageBubble.tsx`
- `src/contexts/WhatsAppDataContext.tsx`
- `src/lib/uazapi/types.ts`
- `src/components/chat/ForwardDialog.tsx`
- `src/components/chat/MediaLightbox.tsx`
- `src/components/chat/MediaPreviewDialog.tsx`
