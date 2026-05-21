import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

type TranscriptionMeta = {
  text?: string | null;
  status?: 'ok' | 'failed' | 'pending';
  reason?: string;
  model?: string;
  generated_at?: string;
  endpoint?: string;
  provider?: string;
};

function translateReason(reason?: string | null): string {
  if (!reason) return '';
  const map: Record<string, string> = {
    download_failed: 'falha ao baixar áudio',
    no_base64: 'mídia vazia',
    audio_too_large: 'áudio muito grande',
    queue_not_found: 'fila não encontrada',
    queue_credentials_missing: 'credenciais da fila ausentes',
    external_id_missing: 'id da mensagem ausente',
    no_api_key: 'IA não configurada',
    not_found: 'mensagem não encontrada',
    bad_request: 'requisição inválida',
    exception: 'erro inesperado',
  };
  if (map[reason]) return map[reason];
  if (/^ai_5/.test(reason)) return 'serviço de IA indisponível';
  if (/^ai_4/.test(reason)) return 'erro na chamada à IA';
  return reason;
}

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
  const [localTranscription, setLocalTranscription] = useState<TranscriptionMeta | null>(null);

  const effective = transcription ?? localTranscription;
  const hasTranscription = !!effective;

  const runGenerate = async (force = false) => {
    if (!messageId) return;
    setGenError(null);
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('chat-transcribe-audio', {
        body: { message_id: messageId, force },
      });
      if (error) throw error;
      // Edge function agora sempre responde 200; falhas vêm como { ok:false, error, reason }
      if (data && data.ok === false) {
        const friendly = translateReason(data.reason) || String(data.error || 'Falha ao transcrever');
        setGenError(friendly);
        // Atualiza estado local para que o botão de retry permaneça visível
        setLocalTranscription({ status: 'failed', reason: data.reason, text: null });
        return;
      }
      const { data: fresh } = await supabase
        .from('chat_messages')
        .select('metadata')
        .eq('id', messageId)
        .maybeSingle();
      const tr = (fresh?.metadata as any)?.transcription;
      if (tr) setLocalTranscription(tr);
      onGenerated?.();
    } catch (e: any) {
      setGenError(e?.message || 'Falha ao transcrever');
    } finally {
      setGenerating(false);
    }
  };

  if (!hasTranscription && !pending) {
    if (!canGenerate || !messageId) return null;
    return (
      <div className={cn('mt-2', className)}>
        <button
          type="button"
          disabled={generating}
          onClick={() => runGenerate(false)}
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

  const status = effective?.status || (pending ? 'pending' : 'failed');
  const text = effective?.text?.trim() || '';
  const isUnavailable = status === 'failed' || /transcri[cç][aã]o indispon[ií]vel/i.test(text) || /[áa]udio inaud[ií]vel/i.test(text);
  // Retry é sempre permitido em falhas, independente das flags de auto-transcrição.
  const canRetry = !!messageId && isUnavailable;

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
          <span className="text-muted-foreground font-normal ml-1">
            indisponível{effective?.reason ? ` · ${translateReason(effective.reason)}` : ''}
          </span>
        )}
        {canRetry && (
          <button
            type="button"
            disabled={generating}
            onClick={() => runGenerate(true)}
            title="Tentar transcrever novamente"
            className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            {generating ? 'Tentando…' : 'Tentar novamente'}
          </button>
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
      {genError && (
        <p className="mt-1 text-[11px] text-destructive">{genError}</p>
      )}
    </div>
  );
}