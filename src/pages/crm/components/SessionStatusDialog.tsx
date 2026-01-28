import { useState, useEffect } from 'react';
import { Bot, Loader2, Phone, Calendar, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { externalDb, SessionStatus } from '@/lib/externalDb';
import { formatTimeSaoPaulo, formatDateShortSaoPaulo } from '@/lib/dateUtils';
import { useToast } from '@/hooks/use-toast';

interface SessionStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whatsappNumber: string;
  codAgent: string;
}

export function SessionStatusDialog({
  open,
  onOpenChange,
  whatsappNumber,
  codAgent,
}: SessionStatusDialogProps) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && whatsappNumber && codAgent) {
      fetchSessionStatus();
    }
  }, [open, whatsappNumber, codAgent]);

  const fetchSessionStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await externalDb.getSessionStatus(whatsappNumber, codAgent);
      setSession(result);
    } catch (err) {
      console.error('Erro ao buscar status da sessão:', err);
      setError('Erro ao carregar status');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!session) return;
    
    setUpdating(true);
    try {
      const newStatus = !session.active;
      await externalDb.updateSessionStatus(session.id, newStatus);
      setSession({ ...session, active: newStatus });
      toast({
        title: newStatus ? 'Atendimento ativado' : 'Atendimento desativado',
        description: `O atendimento foi ${newStatus ? 'ativado' : 'desativado'} com sucesso.`,
      });
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível alterar o status do atendimento.',
      });
    } finally {
      setUpdating(false);
      setConfirmToggle(false);
    }
  };

  const formatWhatsAppNumber = (number: string) => {
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    } else if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return number;
  };

  const getStatusInfo = () => {
    if (!session) {
      return {
        color: 'bg-muted text-muted-foreground',
        icon: 'bg-muted-foreground',
        text: 'Sem Atendimento',
        description: 'Nenhuma sessão encontrada para este contato',
      };
    }
    
    if (session.active) {
      return {
        color: 'bg-green-500/10 text-green-600 border-green-500/20',
        icon: 'bg-green-500',
        text: 'Atendimento Ativo',
        description: 'O agente está atendendo este contato',
      };
    }
    
    return {
      color: 'bg-red-500/10 text-red-600 border-red-500/20',
      icon: 'bg-red-500',
      text: 'Atendimento Encerrado',
      description: 'A sessão de atendimento foi finalizada',
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Status do Atendimento
            </DialogTitle>
            <DialogDescription>
              Informações sobre a sessão de atendimento deste contato
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive text-sm">
                {error}
              </div>
            ) : (
              <>
                {/* Status Badge */}
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="relative">
                    <div className="p-4 rounded-full bg-muted/50">
                      <Bot className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full ${statusInfo.icon} border-2 border-background`} />
                  </div>
                  <Badge variant="outline" className={`text-sm px-4 py-1 ${statusInfo.color}`}>
                    {statusInfo.text}
                  </Badge>
                  <p className="text-xs text-muted-foreground text-center">
                    {statusInfo.description}
                  </p>
                </div>

                <Separator />

                {/* Details */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">WhatsApp:</span>
                    <span className="font-medium">{formatWhatsAppNumber(whatsappNumber)}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Agente:</span>
                    <span className="font-medium">{codAgent}</span>
                  </div>

                  {session && (
                    <>
                      <div className="flex items-center gap-3 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Criado em:</span>
                        <span className="font-medium">
                          {formatDateShortSaoPaulo(new Date(session.created_at).getTime())} às {formatTimeSaoPaulo(new Date(session.created_at).getTime())}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Atualizado em:</span>
                        <span className="font-medium">
                          {formatDateShortSaoPaulo(new Date(session.updated_at).getTime())} às {formatTimeSaoPaulo(new Date(session.updated_at).getTime())}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Status Toggle - Similar to AgentsList */}
                {session && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between py-2">
                      <Label htmlFor="session-status" className="text-sm font-medium">
                        Status do Atendimento
                      </Label>
                      <Switch
                        id="session-status"
                        checked={session.active}
                        onCheckedChange={() => setConfirmToggle(true)}
                        disabled={updating}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog - Same style as AgentsList */}
      <AlertDialog open={confirmToggle} onOpenChange={setConfirmToggle}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {session?.active ? 'Desativar atendimento?' : 'Ativar atendimento?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {session?.active
                ? 'Ao desativar, o agente não responderá mais este contato até que seja ativado novamente.'
                : 'Ao ativar, o agente voltará a responder este contato.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleStatus} disabled={updating}>
              {updating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {session?.active ? 'Desativar' : 'Ativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
