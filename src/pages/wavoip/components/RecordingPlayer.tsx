import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Play, Download, Clock, CircleX, AlertCircle } from 'lucide-react';

interface Props {
  callId: string;
  whatsappCallId: string | null;
  recordingPath: string | null; // agora contém a URL final (signed longa) ou null
  status: string;
  durationSeconds?: number;
  onRefetched?: () => void;
}

function Wrap({ tooltip, children }: { tooltip: string; children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild><span className="inline-flex">{children}</span></TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function RecordingPlayer({ whatsappCallId, recordingPath, status, durationSeconds = 0 }: Props) {
  const [open, setOpen] = useState(false);

  // Sem áudio (duração zero ou marcado como none)
  if (status === 'none' || (durationSeconds === 0 && status !== 'available')) {
    return (
      <Wrap tooltip="Sem gravação disponível (chamada não atendida ou sem áudio)">
        <Button variant="ghost" size="icon" disabled className="text-muted-foreground">
          <CircleX className="h-4 w-4" />
        </Button>
      </Wrap>
    );
  }

  // Disponível
  if (status === 'available' && recordingPath) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" title="Ouvir gravação" className="text-emerald-600 hover:text-emerald-700">
            <Play className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Gravação Wavoip</div>
            <audio src={recordingPath} controls className="w-full" />
            <a href={recordingPath} download className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <Download className="h-3 w-3" /> Baixar
            </a>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Erro
  if (status === 'error') {
    return (
      <Wrap tooltip="Erro ao baixar a gravação. Nova tentativa será feita em breve.">
        <Button variant="ghost" size="icon" disabled className="text-destructive">
          <AlertCircle className="h-4 w-4" />
        </Button>
      </Wrap>
    );
  }

  // Aguardando (pending / downloading / recording / ready ainda não baixado)
  if (!whatsappCallId) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <Wrap tooltip="Aguardando processamento da gravação pela Wavoip">
      <Button variant="ghost" size="icon" disabled className="text-muted-foreground">
        <Clock className="h-4 w-4" />
      </Button>
    </Wrap>
  );
}