// Utilities to find URLs in chat messages and normalize them for preview.

const URL_REGEX = /\bhttps?:\/\/[^\s<>"')]+/i;

/** Extract the first http(s) URL from a free-form text, ignoring inline code spans. */
export function extractFirstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  // Remove ``` blocks and `inline` code so links inside aren't previewed.
  const stripped = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ');
  const m = stripped.match(URL_REGEX);
  if (!m) return null;
  // Trim trailing punctuation like ., , ; : ! ?
  return m[0].replace(/[.,;:!?)]+$/, '');
}

export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return null;
  }
}