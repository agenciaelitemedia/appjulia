import React, { useMemo } from 'react';
import { renderWhatsAppMarkdown } from '@/lib/whatsappFormat';
import { cn } from '@/lib/utils';

interface MessagePreviewProps {
  text: string;
  className?: string;
}

/**
 * Live preview of how the message will look on WhatsApp after markdown rendering.
 */
export function MessagePreview({ text, className }: MessagePreviewProps) {
  const html = useMemo(() => renderWhatsAppMarkdown(text), [text]);
  if (!text.trim()) {
    return (
      <div className={cn('text-xs text-muted-foreground italic px-3 py-2', className)}>
        Nada para pré-visualizar.
      </div>
    );
  }
  return (
    <div
      className={cn(
        'text-sm leading-relaxed px-3 py-2 max-h-32 overflow-y-auto',
        'bg-emerald-500/5 border-l-2 border-emerald-500/40',
        className,
      )}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
