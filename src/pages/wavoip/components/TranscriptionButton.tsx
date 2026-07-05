import { useState } from 'react';
import { FileText, Loader2, Sparkles, RotateCcw, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { WavoipCall } from '../hooks/useWavoipCallHistory';

interface Props {
  call: WavoipCall;
  planAllowsTranscription: boolean;
  onRefetch?: () => void;
}

function DialogLine({ line }: { line: string }) {
  const m = line.match(/^\s*(Atendente|Cliente)\s*:\s*(.*)$/i);
  if (!m) return <div className="text-xs text-muted-foreground italic">{line}</div>;
  const speaker = m[1];
  const text = m[2];
  const isAttendant = /atendente/i.test(speaker);
  return (
    <div className="flex gap-2 text-sm py-0.5">
      <span
        className={cn(
          'font-semibold shrink-0 w-20',
          isAttendant ? 'text-primary' : 'text-emerald-600',
        )}
      >
        {isAttendant ? 'Atendente' : 'Cliente'}:
      </span>
      <span className="whitespace-pre-wrap break-words flex-1">{text}</span>
    </div>
  );
}

export function TranscriptionButton({ call, planAllowsTranscription, onRefetch }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const status = call.transcription_status || 'pending';
  const hasRecording = call.recording_status === 'available';
  const hasTranscription = status === 'ok' && !!call.transcription_text;

  // Determine visual state + tooltip text
  let tooltip = 'Ver transcrição e resumo';
  let iconColor = 'text-primary';
  let disabled = false;
  let onClick: (() => void) | undefined;

  const startTranscription = async () => {
    setBusy(true);
    try {
      await supabase.functions.invoke('wavoip-transcribe-recording', {
        body: { call_id: call.id, force: true },
      });
      toast.success('Transcrição iniciada');
      onRefetch?.();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao iniciar transcrição');
    } finally { setBusy(false); }
  };

  if (!planAllowsTranscription) {
    tooltip = 'Transcrição desativada no plano — ative em Planos Wavoip';
    iconColor = 'text-destructive';
    disabled = true;
  } else if (!hasRecording) {
    tooltip = 'Sem gravação disponível para transcrever';
    iconColor = 'text-muted-foreground';
    disabled = true;
  } else if (status === 'processing') {
    tooltip = 'Transcrevendo…';
    iconColor = 'text-amber-500';
    disabled = true;
  } else if (status === 'pending') {
    tooltip = 'Iniciar transcrição';
    iconColor = 'text-muted-foreground';
    onClick = startTranscription;
  } else if (status === 'failed') {
    tooltip = 'Falha na transcrição — clique para tentar novamente';
    iconColor = 'text-muted-foreground';
    onClick = startTranscription;
  } else if (status === 'disabled') {
    tooltip = 'Transcrição desativada no plano — ative em Planos Wavoip';
    iconColor = 'text-destructive';
    disabled = true;
  } else if (hasTranscription) {
    tooltip = 'Ver transcrição e resumo';
    iconColor = 'text-primary';
    onClick = () => setOpen(true);
  }

  const regenerate = async () => {
    setBusy(true);
    try {
      await supabase.functions.invoke('wavoip-transcribe-recording', {
        body: { call_id: call.id, force: true },
      });
      toast.success('Regenerando transcrição…');
      onRefetch?.();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao regenerar');
    } finally { setBusy(false); }
  };

  const copyAll = async () => {
    const txt = `${call.transcription_summary ? `Resumo:\n${call.transcription_summary}\n\n` : ''}Transcrição:\n${call.transcription_text ?? ''}`;
    try {
      await navigator.clipboard.writeText(txt);
      toast.success('Copiado');
    } catch { toast.error('Falha ao copiar'); }
  };

  const lines = (call.transcription_text ?? '').split(/\r?\n/).filter((l) => l.trim().length > 0);

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                size="icon"
                variant="ghost"
                disabled={disabled || busy}
                onClick={onClick}
                className="h-8 w-8"
                aria-label={tooltip}
              >
              {busy || status === 'processing' ? (
                  <Loader2 className={cn('h-4 w-4 animate-spin', iconColor)} />
                ) : (
                  <FileText className={cn('h-4 w-4', iconColor)} />
                )}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Transcrição da chamada
            </DialogTitle>
          </DialogHeader>

          {call.transcription_summary && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
              <div className="flex items-center gap-1.5 text-primary/80 font-medium mb-1.5 text-xs">
                <Sparkles className="h-3 w-3" /> Resumo
              </div>
              <div
                className="whitespace-pre-wrap break-words text-foreground/90 leading-snug"
                dangerouslySetInnerHTML={{
                  __html: (call.transcription_summary || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'),
                }}
              />
            </div>
          )}

          <div className="rounded-md border p-3 max-h-[50vh] overflow-y-auto space-y-0.5">
            <div className="text-xs font-medium text-muted-foreground mb-2">Transcrição</div>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Sem conteúdo transcrito.</p>
            ) : lines.map((l, i) => <DialogLine key={i} line={l} />)}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={copyAll}>
              <Copy className="h-4 w-4 mr-1" /> Copiar
            </Button>
            <Button variant="outline" size="sm" onClick={regenerate} disabled={busy}>
              <RotateCcw className={cn('h-4 w-4 mr-1', busy && 'animate-spin')} /> Regenerar
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}