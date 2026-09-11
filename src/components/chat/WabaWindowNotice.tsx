import { useState } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WabaTemplateSendDialog } from './WabaTemplateSendDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  queueId: string | null;
  toPhone: string | null;
  lastInboundAt: string | null;
}

/**
 * Aviso no meio do chat quando a conversa da API Oficial está fora da janela
 * de 24 horas: o envio livre fica bloqueado e só um modelo aprovado reabre.
 */
export function WabaWindowNotice({ queueId, toPhone, lastInboundAt }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex justify-center my-4">
      <div className="w-full max-w-xl rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          Fora da janela de 24 horas do WhatsApp oficial
        </div>
        <p className="text-xs text-muted-foreground">
          O envio de mensagens, áudios e arquivos está bloqueado.
          {lastInboundAt
            ? ` A última mensagem do cliente foi em ${format(new Date(lastInboundAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.`
            : ' Este contato ainda não enviou nenhuma mensagem.'}{' '}
          Para reabrir a conversa, envie um modelo aprovado.
        </p>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
          <FileText className="h-4 w-4" />
          Enviar modelo aprovado
        </Button>
      </div>

      <WabaTemplateSendDialog
        open={open}
        onOpenChange={setOpen}
        queueId={queueId}
        toPhone={toPhone}
      />
    </div>
  );
}
