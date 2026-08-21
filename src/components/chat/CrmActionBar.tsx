import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Scale, ExternalLink, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toggleJuliaSession } from '@/lib/juliaSessionControl';
import { useAgentSessionStatus } from '@/hooks/useAgentSessionStatus';
import { useContractInfo } from '@/pages/crm/hooks/useContractInfo';

import { useQueueAgentLink } from '@/hooks/useQueueAgentLink';
import { SessionStatusDialog } from '@/pages/crm/components/SessionStatusDialog';


export interface CrmActionBarProps {
  phone: string;
  queueId: string | null | undefined;
  contactName: string;
  className?: string;
}

/**
 * Barra de ações "Julia" (contrato, card do CRM, link externo, status e toggle
 * da sessão). Exibida na coluna lateral direita fixa do chat.
 */
export function CrmActionBar({ phone, queueId, contactName, className }: CrmActionBarProps) {
  const navigate = useNavigate();
  const { data: queueLink } = useQueueAgentLink(queueId);
  const codAgent = queueLink?.codAgent ?? null;

  const { data: contractInfo } = useContractInfo(phone, codAgent ?? '', !!codAgent);

  const {
    session: sessionData,
    isLoading: sessionLoading,
    invalidate: invalidateSession,
  } = useAgentSessionStatus(phone || null, codAgent);
  const [updatingSession, setUpdatingSession] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  const handleToggleSession = async () => {
    if (!sessionData) return;
    setUpdatingSession(true);
    try {
      const newStatus = !sessionData.active;
      await toggleJuliaSession({
        sessionId: sessionData.id,
        active: newStatus,
        codAgent: codAgent!,
        whatsappNumber: phone,
        hubFila: queueLink?.hub as any,
      });
      invalidateSession();
    } catch {
      /* noop */
    } finally {
      setUpdatingSession(false);
      setConfirmToggle(false);
    }
  };

  if (!queueLink?.hasAgent || !codAgent) return null;

  return (
    <>
      <div className={cn('inline-flex items-center gap-1 border rounded px-2 py-1', className)}>
        <span className="text-[10px] text-muted-foreground mr-1 font-medium">Julia</span>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => contractInfo && undefined}
              disabled={!contractInfo}
              className={cn('p-1 rounded hover:bg-muted transition-colors', !contractInfo && 'opacity-40 cursor-not-allowed')}
            >
              <Scale className={cn('h-4 w-4', contractInfo ? 'text-primary' : 'text-muted-foreground')} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{contractInfo ? 'Ver contrato' : 'Sem contrato'}</TooltipContent>
        </Tooltip>




        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => navigate(`/crm/leads?whatsapp=${encodeURIComponent(phone)}`)}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-blue-500" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Ver no CRM</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setStatusDialogOpen(true)}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <Bot className={cn(
                'h-4 w-4',
                sessionLoading ? 'text-muted-foreground animate-pulse' :
                sessionData?.active === true ? 'text-green-500' :
                sessionData?.active === false ? 'text-red-500' :
                'text-muted-foreground'
              )} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Status do agente Julia</TooltipContent>
        </Tooltip>

        <Switch
          checked={sessionData?.active ?? false}
          onCheckedChange={() => setConfirmToggle(true)}
          disabled={!sessionData || updatingSession || sessionLoading}
          className="scale-75"
        />
      </div>

      <AlertDialog open={confirmToggle} onOpenChange={setConfirmToggle}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {sessionData?.active ? 'Desativar atendimento?' : 'Ativar atendimento?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sessionData?.active
                ? 'Ao desativar, o agente não responderá mais este contato até ser ativado novamente.'
                : 'Ao ativar, o agente voltará a responder este contato.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingSession}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleSession} disabled={updatingSession}>
              {updatingSession && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {sessionData?.active ? 'Desativar' : 'Ativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SessionStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        whatsappNumber={phone}
        codAgent={codAgent!}
      />

    </>
  );
}
