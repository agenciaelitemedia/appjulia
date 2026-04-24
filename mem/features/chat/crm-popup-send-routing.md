---
name: CRM Popup — Send Routing for Linked Queue
description: When CRM WhatsApp popup detects a linked queue, both text and media (incl. audio) flow through the queue pipeline (UaZapi proxy or WABA edge with queue_id) and persist into chat_messages so Realtime updates the popup. Direct UaZapi keeps legacy direct-client send.
type: feature
---
CRM popup (`WhatsAppMessagesDialog.tsx`) sending logic:

- **Linked queue (useDbSource = true)**: `sendViaQueue({ kind: 'text' | 'media' })` is used by `handleSendMessage`, `sendAudioBlob`, and file input.
  - WABA → `waba-send` with `queue_id`.
  - UaZapi → `uazapi-proxy` with `queue.evo_apikey` + `queue.evo_url`.
  - Media uploaded to `chat-media` via `chat-media-upload` for preview/persistence.
  - Outgoing message inserted into `chat_messages` (channel_type matches queue); existing Realtime subscription renders bubble — no manual local push.
  - Audio recorded as `audio/webm` is relabeled to `audio/ogg` for WABA only.
- **Direct UaZapi**: legacy path unchanged (`client.post('/send/...')` + local `setMessages`).
- Conversation id resolved best-effort from `chat_conversations` (open|pending) — never blocks send.
