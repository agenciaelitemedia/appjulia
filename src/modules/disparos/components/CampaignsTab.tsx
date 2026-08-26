import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Play, Pause, Ban, Plus, Pencil, Trash2, Loader2, Search, Send, Check, X, CalendarClock, Clock } from 'lucide-react';
import { CAMPAIGN_STATUS_LABEL, APPROVAL_STATUS_LABEL } from '../module';
import { useAuth } from '../extend/auth';
import { useDspCampaigns, useDspCampaignControl, useDeleteDspCampaign } from '../hooks/useDspCampaigns';
import { useDspWaitReasons } from '../hooks/useDspWaitReason';
import { useDspProviderDefaults } from '../hooks/useDspProviderDefaults';
import { CampaignWizardDialog } from './CampaignWizardDialog';
import type { DspCampaign } from '../types';

/** Texto amigável do motivo de espera reportado pelo worker. */
function waitReasonLabel(reason: string, window: { start?: string; end?: string } | null): string | null {
  switch (reason) {
    case 'outside_channel_window':
      return window?.start
        ? `Aguardando janela do canal (${window.start}–${window.end})`
        : 'Aguardando janela de envio do canal';
    case 'channel_disconnected':
      return 'Aguardando: canal desconectado';
    case 'channel_cooldown':
      return 'Aguardando: canal em cooldown de segurança';
    case 'rate_limited':
      return 'Aguardando: limite de envio por minuto/hora atingido';
    case 'block_pause':
      return 'Aguardando: pausa entre blocos de mensagens';
    case 'no_channel_available':
      return 'Aguardando canal disponível';
    default:
      return `Aguardando: ${reason}`;
  }
}


const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (s === 'running') return 'default';
  if (s === 'failed' || s === 'cancelled') return 'destructive';
  if (s === 'completed') return 'secondary';
  return 'outline';
};

const approvalVariant = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (s === 'approved') return 'default';
  if (s === 'rejected') return 'destructive';
  if (s === 'pending') return 'secondary';
  return 'outline';
};

const scheduleLabel = (c: DspCampaign): string | null => {
  const start = c.schedule_start_at ?? c.scheduled_at;
  if (!start && !c.schedule_end_at) return null;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { timeZone: c.timezone || 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  const parts: string[] = [];
  if (start) parts.push(`de ${fmt(start)}`);
  if (c.schedule_end_at) parts.push(`até ${fmt(c.schedule_end_at)}`);
  return `${parts.join(' ')} (${c.timezone || 'America/Sao_Paulo'})`;
};

export function CampaignsTab({ clientId, canEdit }: { clientId: string | null; canEdit: boolean }) {
  const { user, isAdmin } = useAuth();
  const actor = user?.id != null ? String(user.id) : undefined;
  const { data: campaigns = [], isLoading } = useDspCampaigns(clientId);
  const control = useDspCampaignControl();
  const remove = useDeleteDspCampaign();
  const { data: waitReasons = {} } = useDspWaitReasons(clientId);
  const { data: providerDefaults = [] } = useDspProviderDefaults(clientId);
  const providerWindow = useMemo(() => {
    const uaz = providerDefaults.find((p: any) => p.provider === 'uazapi') ?? providerDefaults[0];
    return uaz ? { start: (uaz as any).send_window_start, end: (uaz as any).send_window_end } : null;
  }, [providerDefaults]);



  const [search, setSearch] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<DspCampaign | null>(null);
  const [confirm, setConfirm] = useState<{ campaign: DspCampaign; action: 'start' | 'cancel' | 'delete' } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<DspCampaign | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const filtered = useMemo(
    () => campaigns.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [campaigns, search],
  );

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.action === 'delete') remove.mutate(confirm.campaign.id);
    else control.mutate({ action: confirm.action, campaign_id: confirm.campaign.id });
    setConfirm(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar campanha..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setWizardOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Nova campanha
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma campanha ainda. Crie a primeira e simule antes de disparar.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((c) => {
          const progress = c.total_eligible > 0 ? Math.round((c.total_sent / c.total_eligible) * 100) : 0;
          const wait = c.status === 'running' ? waitReasons[c.id] : undefined;
          const waitLabel = wait ? waitReasonLabel(wait.reason, providerWindow) : null;
          return (
            <Card key={c.id} className="border-2">
              <CardContent className="py-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{c.name}</span>
                      <Badge variant={statusVariant(c.status)}>
                        {CAMPAIGN_STATUS_LABEL[c.status] ?? c.status}
                      </Badge>
                      <Badge variant="outline">{c.category}</Badge>
                      <Badge variant={approvalVariant(c.approval_status)}>
                        {APPROVAL_STATUS_LABEL[c.approval_status] ?? c.approval_status}
                      </Badge>
                    </div>
                    {waitLabel && (
                      <p className="flex items-center gap-1 text-xs text-amber-600">
                        <Clock className="h-3 w-3" /> {waitLabel}
                        {wait!.pending > 0 && ` · ${wait!.pending} na fila`}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {c.goal || 'Sem objetivo definido'}
                      {c.send_window_start && ` · Janela ${c.send_window_start}–${c.send_window_end}`}
                    </p>

                    {scheduleLabel(c) && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarClock className="h-3 w-3" /> {scheduleLabel(c)}
                        {c.auto_window_control && ' · pausa/retoma automática'}
                      </p>
                    )}
                    {c.approval_notes && (
                      <p className="text-xs text-amber-600">Revisão: {c.approval_notes}</p>
                    )}
                    {c.pause_reason && (
                      <p className="text-xs text-destructive">Pausada: {c.pause_reason}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {canEdit && ['draft', 'rejected'].includes(c.approval_status) && (
                      <Button
                        size="icon" variant="outline" className="h-7 w-7 rounded-full bg-primary/10"
                        title="Enviar para aprovação"
                        onClick={() => control.mutate({ action: 'submit_approval', campaign_id: c.id, actor })}
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isAdmin && c.approval_status === 'pending' && (
                      <>
                        <Button
                          size="icon" variant="outline" className="h-7 w-7 rounded-full bg-emerald-500/10"
                          title="Aprovar campanha"
                          onClick={() => control.mutate({ action: 'approve', campaign_id: c.id, actor })}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="outline" className="h-7 w-7 rounded-full bg-destructive/10"
                          title="Reprovar campanha"
                          onClick={() => { setRejectTarget(c); setRejectNotes(''); }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {canEdit && c.approval_status === 'approved' && (c.schedule_start_at || c.scheduled_at)
                      && ['draft', 'paused'].includes(c.status) && (
                      <Button
                        size="icon" variant="outline" className="h-7 w-7 rounded-full bg-sky-500/10"
                        title="Ativar cronograma (início/pausa automáticos)"
                        onClick={() => control.mutate({ action: 'schedule', campaign_id: c.id, actor })}
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canEdit && c.approval_status === 'approved' && ['draft', 'scheduled', 'paused'].includes(c.status) && (
                      <Button
                        size="icon" variant="outline" className="h-7 w-7 rounded-full bg-primary/10"
                        title={c.status === 'paused' ? 'Retomar' : 'Iniciar disparo'}
                        onClick={() =>
                          c.status === 'paused'
                            ? control.mutate({ action: 'resume', campaign_id: c.id })
                            : setConfirm({ campaign: c, action: 'start' })
                        }
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canEdit && c.status === 'running' && (
                      <Button
                        size="icon" variant="outline" className="h-7 w-7 rounded-full bg-amber-500/10"
                        title="Pausar"
                        onClick={() => control.mutate({ action: 'pause', campaign_id: c.id })}
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canEdit && ['running', 'paused', 'scheduled', 'preparing'].includes(c.status) && (
                      <Button
                        size="icon" variant="outline" className="h-7 w-7 rounded-full bg-destructive/10"
                        title="Cancelar campanha"
                        onClick={() => setConfirm({ campaign: c, action: 'cancel' })}
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        size="icon" variant="outline" className="h-7 w-7 rounded-full bg-muted"
                        title="Editar"
                        onClick={() => { setEditing(c); setWizardOpen(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canEdit && ['draft', 'cancelled', 'completed', 'failed'].includes(c.status) && (
                      <Button
                        size="icon" variant="outline" className="h-7 w-7 rounded-full bg-destructive/10"
                        title="Excluir"
                        onClick={() => setConfirm({ campaign: c, action: 'delete' })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <Progress value={progress} className="h-1.5" />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Elegíveis: <b className="text-foreground">{c.total_eligible}</b></span>
                    <span>Enviados: <b className="text-foreground">{c.total_sent}</b></span>
                    <span>Entregues: {c.total_delivered}</span>
                    <span>Lidas: {c.total_read}</span>
                    <span>Respostas: {c.total_replied}</span>
                    <span className="text-destructive">Falhas: {c.total_failed}</span>
                    <span>Opt-outs: {c.total_optout}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CampaignWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        clientId={clientId}
        campaign={editing}
      />

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reprovar campanha</DialogTitle></DialogHeader>
          <Textarea
            rows={3}
            placeholder="Motivo da reprovação"
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Voltar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectTarget) {
                  control.mutate({ action: 'reject', campaign_id: rejectTarget.id, actor, notes: rejectNotes.trim() || undefined });
                }
                setRejectTarget(null);
              }}
            >
              Reprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === 'start' && 'Iniciar disparo?'}
              {confirm?.action === 'cancel' && 'Cancelar campanha?'}
              {confirm?.action === 'delete' && 'Excluir campanha?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === 'start' &&
                'As mensagens serão enfileiradas e enviadas respeitando os limites, janelas e rotação das filas selecionadas.'}
              {confirm?.action === 'cancel' &&
                'Todas as mensagens pendentes serão canceladas. Os envios já feitos permanecem.'}
              {confirm?.action === 'delete' && 'Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirm}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
