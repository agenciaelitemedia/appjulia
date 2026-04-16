/**
 * WhatsApp markdown utilities.
 * Supports: *bold*, _italic_, ~strike~, ```mono```, lists (- / 1.), > quote.
 */

export type FormatToken = 'bold' | 'italic' | 'strike' | 'mono' | 'code' | 'quote' | 'bullet' | 'numbered';

const WRAPPERS: Partial<Record<FormatToken, { open: string; close: string }>> = {
  bold: { open: '*', close: '*' },
  italic: { open: '_', close: '_' },
  strike: { open: '~', close: '~' },
  mono: { open: '```', close: '```' },
  code: { open: '`', close: '`' },
};

const LINE_PREFIXES: Partial<Record<FormatToken, (i: number) => string>> = {
  quote: () => '> ',
  bullet: () => '- ',
  numbered: (i) => `${i + 1}. `,
};

/**
 * Apply WA formatting at the textarea selection.
 * Returns the new full text and the next selection range.
 */
export function applyFormat(
  text: string,
  selStart: number,
  selEnd: number,
  token: FormatToken,
): { text: string; selStart: number; selEnd: number } {
  const wrapper = WRAPPERS[token];
  if (wrapper) {
    const before = text.slice(0, selStart);
    const middle = text.slice(selStart, selEnd) || 'texto';
    const after = text.slice(selEnd);
    const next = `${before}${wrapper.open}${middle}${wrapper.close}${after}`;
    const start = before.length + wrapper.open.length;
    return { text: next, selStart: start, selEnd: start + middle.length };
  }

  const linePrefix = LINE_PREFIXES[token];
  if (linePrefix) {
    // Expand selection to full lines
    const lineStart = text.lastIndexOf('\n', selStart - 1) + 1;
    const lineEndIdx = text.indexOf('\n', selEnd);
    const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
    const before = text.slice(0, lineStart);
    const block = text.slice(lineStart, lineEnd) || '';
    const after = text.slice(lineEnd);
    const lines = block.split('\n');
    const updated = lines.map((l, i) => `${linePrefix(i)}${l}`).join('\n');
    const next = `${before}${updated}${after}`;
    return { text: next, selStart: lineStart, selEnd: lineStart + updated.length };
  }

  return { text, selStart, selEnd };
}

/**
 * Render WA markdown to safe HTML.
 * Order matters: code blocks first to avoid nested formatting.
 */
export function renderWhatsAppMarkdown(input: string): string {
  if (!input) return '';
  // Escape HTML
  let s = input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Mono blocks ```...```
  s = s.replace(/```([\s\S]+?)```/g, '<pre class="bg-muted/60 rounded px-2 py-1 text-xs font-mono overflow-x-auto">$1</pre>');
  // Inline code `...`
  s = s.replace(/`([^`\n]+)`/g, '<code class="bg-muted/60 rounded px-1 text-xs font-mono">$1</code>');
  // Bold *text*
  s = s.replace(/(^|[\s>])\*([^\s*][^*\n]*[^\s*]|[^\s*])\*(?=[\s.,!?;:)]|$)/g, '$1<strong>$2</strong>');
  // Italic _text_
  s = s.replace(/(^|[\s>])_([^\s_][^_\n]*[^\s_]|[^\s_])_(?=[\s.,!?;:)]|$)/g, '$1<em>$2</em>');
  // Strike ~text~
  s = s.replace(/(^|[\s>])~([^\s~][^~\n]*[^\s~]|[^\s~])~(?=[\s.,!?;:)]|$)/g, '$1<s>$2</s>');
  // Quotes "&gt; text" at line start (already escaped >)
  s = s.replace(/(^|\n)&gt; (.+)/g, '$1<blockquote class="border-l-2 border-primary/40 pl-2 text-muted-foreground">$2</blockquote>');
  // Newlines
  s = s.replace(/\n/g, '<br/>');
  return s;
}
