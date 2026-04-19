// ============================================
// Message Preview Helper
// Single source of truth for "last message" preview text shown in
// conversation lists. Always returns a safe, human-friendly string.
// Never returns "[object Object]" or raw media JSON payloads.
// ============================================

export interface PreviewInput {
  type?: string | null;
  text?: string | null;
  caption?: string | null;
  file_name?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  image: '📷 Imagem',
  video: '🎥 Vídeo',
  audio: '🎵 Áudio',
  ptt: '🎵 Áudio',
  sticker: '🏷️ Sticker',
  location: '📍 Localização',
  contact: '👤 Contato',
  reaction: '💬 Reação',
  revoked: '🚫 Mensagem apagada',
};

const MAX_CHARS = 80;

/** Detect strings that look like a raw media JSON payload (e.g. {"URL":"..."}). */
function looksLikeRawMediaJson(s: string): boolean {
  const t = s.trim();
  if (!(t.startsWith('{') || t.startsWith('['))) return false;
  // Cheap heuristics first.
  if (/"URL"|"url"|"mimetype"|"directPath"|"mediaKey"|"fileSHA256"|"caption"\s*:/i.test(t)) {
    return true;
  }
  try {
    const parsed = JSON.parse(t);
    const obj = Array.isArray(parsed) ? parsed[0] : parsed;
    if (obj && typeof obj === 'object') {
      const keys = Object.keys(obj).map(k => k.toLowerCase());
      return keys.some(k =>
        ['url', 'mimetype', 'directpath', 'mediakey', 'filesha256', 'filelength', 'caption'].includes(k)
      );
    }
  } catch {
    return false;
  }
  return false;
}

/** Try to derive a media type from a raw JSON payload (best-effort). */
function inferTypeFromRawJson(s: string): string | undefined {
  try {
    const parsed = JSON.parse(s);
    const obj = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!obj || typeof obj !== 'object') return undefined;
    const url: string = String(obj.URL || obj.url || obj.directPath || obj.fileURL || '').toLowerCase();
    const mime: string = String(obj.mimetype || obj.mime || obj.contentType || '').toLowerCase();
    if (mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)(\?|$)/.test(url)) return 'image';
    if (mime.startsWith('video/') || /\.(mp4|mov|webm|3gp)(\?|$)/.test(url)) return 'video';
    if (mime.startsWith('audio/') || obj.PTT || obj.ptt || /\.(ogg|opus|mp3|m4a|wav)(\?|$)/.test(url)) {
      return obj.PTT || obj.ptt ? 'ptt' : 'audio';
    }
    if (/sticker/.test(mime)) return 'sticker';
    return 'document';
  } catch {
    return undefined;
  }
}

function clip(text: string): string {
  const single = text.replace(/\s+/g, ' ').trim();
  return single.length > MAX_CHARS ? single.slice(0, MAX_CHARS).trimEnd() + '…' : single;
}

/**
 * Returns a safe, human-friendly preview string for a chat message.
 * Use both when WRITING `last_message_text` and when RENDERING it.
 */
export function getMessagePreview(input: PreviewInput): string {
  const rawText = typeof input.text === 'string' ? input.text : '';
  const caption = typeof input.caption === 'string' ? input.caption.trim() : '';
  const fileName = typeof input.file_name === 'string' ? input.file_name.trim() : '';
  const declaredType = (input.type || '').toLowerCase();

  // 1) Detect & sanitize bad inputs.
  const isObjectStr = rawText === '[object Object]';
  const isRawJson = !isObjectStr && rawText.length > 0 && looksLikeRawMediaJson(rawText);

  // 2) Resolve effective type.
  let type = declaredType;
  if (!type || type === 'text') {
    if (isRawJson) type = inferTypeFromRawJson(rawText) || 'document';
    else if (isObjectStr) type = 'document';
  }

  // 3) Build label by type.
  if (type === 'document') {
    const label = fileName || 'Documento';
    return `📎 ${clip(label)}`;
  }
  if (TYPE_LABELS[type]) {
    const base = TYPE_LABELS[type];
    if (caption) return `${base}: ${clip(caption)}`;
    return base;
  }

  // 4) Fallback: plain text.
  if (isObjectStr || isRawJson) {
    // Last-resort: we know the source was bad data with no usable type.
    return '📎 Mídia';
  }

  if (caption && !rawText) return clip(caption);
  return clip(rawText || caption || '');
}

/** Builds a preview prefixed with the group sender name when applicable. */
export function getGroupAwareMessagePreview(
  input: PreviewInput,
  opts: { isGroup?: boolean; senderName?: string | null } = {}
): string {
  const base = getMessagePreview(input);
  if (opts.isGroup && opts.senderName && opts.senderName.trim()) {
    return `${opts.senderName.trim()}: ${base}`;
  }
  return base;
}
