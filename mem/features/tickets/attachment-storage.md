---
name: Tickets — Attachment Storage
description: Anexos do módulo /tickets vivem em bucket `ticket-media` (privado, signed URLs ~5y), separado do `chat-media` do chat
type: feature
---
Anexos do módulo de chamados (`/tickets`) são armazenados no bucket privado `ticket-media`, separados dos anexos do chat (`chat-media`).

- Upload via edge function `ticket-media-upload` (input: `{ base64, mimetype, fileName, ticketId, source }`); retorna `{ url, path, mimetype }` com signed URL de 5 anos.
- Path: `tickets/<ticket_id>/<timestamp>_<rand>_<safeName>.<ext>`.
- Persistido em `support_ticket_messages.attachments` (jsonb array `[{ type, url, mimetype, file_name }]`).
- Composer permite colar imagem (Ctrl+V) no Textarea → preview → envia anexada à mensagem. Se `Enviar para WhatsApp` estiver ativo, o `dispatchToWhatsApp` envia como `image` (WABA `image.link` / UaZapi `/send/media` com `file: url`) e persiste em `chat_messages` com `type:'image'`, `media_url` e `metadata.attachment_bucket = 'ticket-media'`.
- Não usar `chat-media` para anexos de tickets (módulos distintos).