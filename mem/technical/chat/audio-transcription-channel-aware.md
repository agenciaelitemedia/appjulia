---
name: Transcrição de áudio multicanal
description: chat-transcribe-audio suporta UaZapi (/message/download) e WABA (mídia persistida ou waba-send download_media)
type: feature
---
`supabase/functions/chat-transcribe-audio/index.ts` é channel-aware:
- UaZapi: baixa via `POST {evo_url}/message/download` (base64, decripta `.enc`).
- WABA (`channel_type` whatsapp_waba/waba): usa `media_url` http já persistido no bucket `chat-media`; se ausente, resolve o media id de `media_url` (`waba_media:<id>`), `metadata.waba_media_id` ou `raw_payload.audio.id` e baixa via `waba-send` action `download_media`.
- Áudios outbound registrados via API (`metadata.source='api'`, sem `media_url`/`raw_payload`) não têm mídia armazenada → reason `no_media`.
Reasons traduzidos em `src/components/chat/messages/TranscriptionBlock.tsx`: `waba_credentials_missing`, `waba_media_id_missing`, `no_media`.

Uso interno (X-Julia): body `{ message_id, internal: true }` transcreve mesmo com a feature desligada e grava em `metadata.transcription_internal` (invisível no chat); com flags client+fila ligadas grava em `metadata.transcription`. A resposta de sucesso sempre devolve `text`. `MessageBubble` exibe a chave interna só quando `canTranscribe`. `_shared/x-julia/documents.ts` usa essa chamada para áudio antes do fallback de leitura inline.
