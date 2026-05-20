import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

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
  /** Message id, required to allow manual generation. */
  messageId?: string;
  /** Show a "Gerar transcrição" button when no transcription exists. */
  canGenerate?: boolean;
  /** Callback after a successful generation (e.g. refetch messages). */
  onGenerated?: () => void;
}

export function TranscriptionBlock({ transcription, pending, className, messageId, canGenerate, onGenerated }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const hasTranscription = !!transcription;

  if (!hasTranscription && !pending) {
    if (!canGenerate || !messageId) return null;
    return (
      <div className={cn('mt-2', className)}>
        <button
          type="button"
          disabled={generating}
          onClick={async () => {
            setGenError(null);
            setGenerating(true);
            try {
              const { data, error } = await supabase.functions.invoke('chat-transcribe-audio', {
                body: { message_id: messageId },
              });
              if (error) throw error;
              if (data?.error) throw new Error(String(data.error));
              onGenerated?.();
            } catch (e: any) {
              setGenError(e?.message || 'Falha ao transcrever');
            } finally {
              setGenerating(false);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-60"
        >
          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {generating ? 'Gerando transcrição…' : 'Gerar transcrição'}
        </button>
        {genError && (
          <p className="mt-1 text-[11px] text-destructive">{genError}</p>
        )}
      </div>
    );
  }

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