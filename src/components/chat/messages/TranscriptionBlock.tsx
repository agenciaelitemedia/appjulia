import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type TranscriptionMeta = {
  text?: string | null;
  status?: 'ok' | 'failed' | 'pending';
  reason?: string;
  model?: string;
  generated_at?: string;
};

interface Props {
  transcription?: TranscriptionMeta | null;
  /** Show a "pending" placeholder when transcription is enabled but not yet computed. */
  pending?: boolean;
  className?: string;
}

export function TranscriptionBlock({ transcription, pending, className }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!transcription && !pending) return null;

  const status = transcription?.status || (pending ? 'pending' : 'failed');
  const text = transcription?.text?.trim() || '';

  return (
    <div
      className={cn(
        'mt-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2 text-xs',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-primary/80 font-medium">
        <Sparkles className="h-3 w-3" />
        <span>Transcrição</span>
        {status === 'pending' && (
          <span className="flex items-center gap-1 text-muted-foreground font-normal ml-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            gerando…
          </span>
        )}
        {status === 'failed' && (
          <span className="text-muted-foreground font-normal ml-1">indisponível</span>
        )}
      </div>

      {status === 'ok' && text && (
        <>
          <p
            className={cn(
              'mt-1 whitespace-pre-wrap break-words text-foreground/90 leading-snug',
              !expanded && 'line-clamp-2',
            )}
          >
            {text}
          </p>
          {text.length > 120 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              {expanded ? (
                <>
                  Recolher <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  Ver transcrição <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}