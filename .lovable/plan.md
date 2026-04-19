

## Problem

Meta WhatsApp webhook returns error `131053`:
> *"Audio file uploaded with mimetype as audio/ogg; codecs=opus, however on processing it is of type application/octet-stream."*

## Root cause

`AudioRecorder.tsx` mislabels the recorded blob:
- Browser `MediaRecorder` records in **WebM/Opus** container (Chrome/Edge default).
- Code forces `new Blob(chunks, { type: 'audio/ogg;codecs=opus' })` — this only renames the MIME, **does not transcode** the container bytes.
- Meta Graph API inspects the actual file header, sees WebM bytes (not OGG magic bytes `OggS`), classifies it as `application/octet-stream`, and rejects.
- Meta's WABA voice notes only accept true **OGG/Opus** containers.

## Fix: client-side WebM → OGG remux

Use a tiny pure-JS remuxer to convert the WebM/Opus container to OGG/Opus without re-encoding the audio (just rewraps the Opus packets). This keeps the file small and avoids ffmpeg/WASM bloat.

### Approach

1. Install `webm-to-opus` (a ~5KB pure JS package that extracts Opus packets from WebM and wraps them in an OGG container). Alternative: write a small inline remuxer using the WebM EBML parser.
2. After recording stops in `AudioRecorder.tsx`, detect the actual mimetype the recorder used. If it's WebM, run the remux step before producing the final Blob.
3. The output Blob will have a real OGG/Opus header (`OggS...`) → Meta accepts it.
4. Keep the existing `audio/ogg; codecs=opus` MIME label in the edge function (already correct).

### Files to change

- **`src/components/chat/AudioRecorder.tsx`** — after `mediaRecorder.onstop`, if the captured chunks are WebM, remux them to OGG before calling `onSend`.
- **`package.json`** — add `webm-to-opus` (or equivalent).
- **`supabase/functions/waba-send/index.ts`** — no change needed; the upload logic already labels audio correctly.

### Fallback

If Safari/iOS produces `audio/mp4` (AAC), fall back to sending as `audio/mp4` (Meta accepts that natively) — no remux needed.

### Why this is the right fix

- Server-side transcoding (ffmpeg in an edge function) is heavy and cold-start-prone.
- Browser-side remux is instant (no re-encode, just container swap).
- UaZapi works fine today because it accepts WebM via its own pipeline; only Meta is strict.

