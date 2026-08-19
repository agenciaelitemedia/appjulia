import { useEffect, useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle2, Clock, Hash, Loader2, Phone, Send, Trash2, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatDbDateTime } from '@/lib/dateUtils';
import { useAuth } from '../extend/auth';
import { ALERT_TRIGGERS } from '../module';
import type { AlertCrmCard } from '../types';
import {
  useAddAlertCrmCardAction,
  useAlertCrmCardActions,
  useDeleteAlertCrmCard,
  useResolveAlertCrmCard,
} from '../hooks/useAlertCrmCards';

interface Props {
  card: AlertCrmCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlertCrmCardDetailsDialog({ card, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [actionText, setActionText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recoveredDialogOpen, setRecoveredDialogOpen] = useState(false);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setActionText('');
      setConfirmDelete(false);
      setDeleteDialogOpen(false);
      setRecoveredDialogOpen(false);
      setLostDialogOpen(false);
    }
  }, [open]);

  const { data: actions = [], isLoading: actionsLoading } = useAlertCrmCardActions(
    open ? card?.id ?? null : null,
  );
  const addAction = useAddAlertCrmCardAction();
  const resolveCard = useResolveAlertCrmCard();
  const deleteCard = useDeleteAlertCrmCard();

  if (!card) return null;

  const trigger = ALERT_TRIGGERS.find((t) => t.key === card.trigger_key);
  const userName = user?.name ?? null;

  const handleAddAction = () => {
    const text = actionText.trim();
    if (!text) return;
    addAction.mutate(
      { cardId: card.id, actionText: text, userName, userId: user?.id ? String(user.id) : null },
      {
        onSuccess: () => {
          setActionText('');
          toast.success('Ação registrada');
        },
        onError: () => toast.error('Erro ao registrar ação'),
      },
    );
  };

  const handleResolve = (status: 'recovered' | 'lost') => {
    resolveCard.mutate(
      { cardId: card.id, status, userName },
      {
        onSuccess: () => {
          toast.success(status === 'recovered' ? 'Lead marcado como recuperado' : 'Lead marcado como perdido');
          onOpenChange(false);
        },
        onError: () => toast.error('Erro ao atualizar o card'),
      },
    );
  };

  const handleDelete = () => {
    deleteCard.mutate(card.id, {
      onSuccess: () => {
        toast.success('Card excluído do CRM de Notificações');
        setConfirmDelete(false);
        onOpenChange(false);
      },
      onError: () => toast.error('Erro ao excluir o card'),
    });
  };

  const timeInStage = formatDistanceToNow(new Date(card.stage_entered_at), {
    addSuffix: false,
    locale: ptBR,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            {card.lead_name || 'Sem nome'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="acoes" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">Informações</TabsTrigger>
            <TabsTrigger value="acoes" className="flex-1">Ações de Recuperação</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4 flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-3">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Alerta</span>
                  <Badge variant="outline">{trigger?.label || card.trigger_key}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />WhatsApp</span>
                  <span>{card.lead_phone || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" />Agente</span>
                  <span>[{card.cod_agent}]</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Escritório</span>
                  <span className="truncate max-w-[220px]">{card.business_name || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Etapa no CRM da Julia</span>
                  <span>{card.crm_stage_label || 'Sem etapa'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Responsável</span>
                  <span>{card.owner_name || 'Sem responsável'}</span>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Criado</span>
                  <span>{formatDbDateTime(card.created_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Atualizado</span>
                  <span>{formatDbDateTime(card.updated_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Na fase</span>
                  <span>{timeInStage}</span>
                </div>
                {card.status !== 'open' && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Situação</span>
                    <Badge variant={card.status === 'recovered' ? 'default' : 'destructive'}>
                      {card.status === 'recovered' ? 'Recuperado' : 'Perdido'}
                      {card.resolved_by ? ` • ${card.resolved_by}` : ''}
                    </Badge>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="acoes" className="mt-4 flex-1 overflow-hidden flex flex-col">
            <div className="space-y-2">
              <Textarea
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder="O que foi feito com o lead? (ex.: ligação realizada, mensagem enviada...)"
                rows={3}
              />
              <Button
                size="sm"
                className="w-full gap-1.5"
                onClick={handleAddAction}
                disabled={!actionText.trim() || addAction.isPending}
              >
                {addAction.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Registrar ação
              </Button>
            </div>

            <Separator className="my-3" />

            <ScrollArea className="flex-1 pr-3">
              {actionsLoading ? (
                <p className="text-xs text-muted-foreground">Carregando...</p>
              ) : actions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma ação registrada ainda.</p>
              ) : (
                <div className="space-y-3">
                  {actions.map((a, idx) => (
                    <div key={a.id} className="relative pl-5">
                      <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-primary" />
                      {idx < actions.length - 1 && (
                        <span className="absolute left-[3px] top-4 bottom-[-12px] w-px bg-border" />
                      )}
                      <p className="text-sm whitespace-pre-wrap">{a.action_text}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.created_by_name || 'Sistema'} • {formatDbDateTime(a.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <Separator className="my-3" />

            {card.status === 'open' && (
              <div className="space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-green-600 border-green-500/40 hover:bg-green-100/50 dark:hover:bg-green-900/30"
                  onClick={() => setRecoveredDialogOpen(true)}
                  disabled={resolveCard.isPending}
                >
                  {resolveCard.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Recuperado
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-red-600 border-red-500/40 hover:bg-red-100/50 dark:hover:bg-red-900/30"
                  onClick={() => setLostDialogOpen(true)}
                  disabled={resolveCard.isPending}
                >
                  {resolveCard.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  Perdido
                </Button>
              </div>
            )}

            <div className="mt-3">
              <Button
                variant="destructive"
                size="sm"
                className="w-full gap-1.5"
                disabled={deleteCard.isPending}
                onClick={() => setDeleteDialogOpen(true)}
              >
                {deleteCard.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Excluir card do CRM de Notificações
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <AlertDialog open={recoveredDialogOpen} onOpenChange={setRecoveredDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                Marcar como recuperado?
              </AlertDialogTitle>
              <AlertDialogDescription>
                O lead <strong>{card.lead_name || card.lead_phone || 'Sem nome'}</strong> será movido para a coluna <strong>Recuperado</strong> e removido do CRM de Notificações ativo. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setRecoveredDialogOpen(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={(e) => {
                  e.preventDefault();
                  handleResolve('recovered');
                }}
              >
                {resolveCard.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Sim, marcar como recuperado
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={lostDialogOpen} onOpenChange={setLostDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                Marcar como perdido?
              </AlertDialogTitle>
              <AlertDialogDescription>
                O lead <strong>{card.lead_name || card.lead_phone || 'Sem nome'}</strong> será movido para a coluna <strong>Perdido</strong> e removido do CRM de Notificações ativo. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setLostDialogOpen(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={(e) => {
                  e.preventDefault();
                  handleResolve('lost');
                }}
              >
                {resolveCard.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Sim, marcar como perdido
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Excluir card permanentemente?
              </AlertDialogTitle>
              <AlertDialogDescription>
                O card de <strong>{card.lead_name || card.lead_phone || 'Sem nome'}</strong> será removido permanentemente do CRM de Notificações, junto com todo o histórico de ações de recuperação. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex items-center gap-3 rounded-lg border p-3 my-3">
              <Switch
                id="confirm-delete-card"
                checked={confirmDelete}
                onCheckedChange={setConfirmDelete}
              />
              <Label htmlFor="confirm-delete-card" className="text-sm cursor-pointer">
                Confirmo a exclusão definitiva deste card e de todo o histórico
              </Label>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                disabled={!confirmDelete || deleteCard.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  if (!confirmDelete) return;
                  handleDelete();
                }}
              >
                {deleteCard.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Excluir permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
