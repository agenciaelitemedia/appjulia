---
name: Chat Audio Transcription Block
description: Padrão visual da caixa de transcrição abaixo de mensagens de áudio
type: design
---

Componente: `src/components/chat/messages/TranscriptionBlock.tsx`.

Renderizado em `MessageBubble` nos casos `audio`/`ptt` quando `message.metadata.transcription` existe.

- Container: `rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2 text-xs mt-2`.
- Header: `Sparkles` (3x3) + "Transcrição" em `text-primary/80`.
- Estados: `pending` (Loader2 spin + "gerando…"), `failed` ("indisponível"), `ok` (texto).
- Colapsado por padrão com `line-clamp-2`; toggle "Ver transcrição / Recolher" aparece quando `text.length > 120`.
- Persistência: `metadata.transcription = { text, status, model, generated_at, reason? }`.