import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, ArrowRightLeft, AlertTriangle, Loader2, CheckCircle2, Undo2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { TeamMemberSelect, type TeamMemberOption } from '@/components/TeamMemberSelect';
import { useTeamByClient } from '@/hooks/useTeamByClient';
import { useChatAssignedCountsByMember } from '@/hooks/useChatAssignedCountsByMember';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useBulkTransferConversations,
  type BulkTransferFilters,
  type BulkTransferStatus,
} from '@/hooks/useBulkTransferConversations';

type TargetType = 'assign' | 'return_queue';

function startOfDayISO(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x.toISOString();
}
function endOfDayISO(d: Date) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x.toISOString();
}

export function BulkTransferConversationsCard() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : null;

  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const [queueId, setQueueId] = useState<string>('all');
  const [currentAssignee, setCurrentAssignee] = useState<string>('all');
  const [statusOpen, setStatusOpen] = useState(true);
  const [statusPending, setStatusPending] = useState(true);
  const [targetType, setTargetType] = useState<TargetType>('assign');
  const [targetMember, setTargetMember] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [understood, setUnderstood] = useState(false);

  const { previewMutation, commitMutation } = useBulkTransferConversations();
  const preview = previewMutation.data;

  const { data: team } = useTeamByClient();
  const { data: assignedCounts } = useChatAssignedCountsByMember();
  const members: TeamMemberOption[] = useMemo(
    () => (team || []).map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role, photo: m.photo })),
    [team],
  );

  const { data: queues = [] } = useQuery({
    queryKey: ['bulk-transfer-queues', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('queues')
        .select('id, name')
        .eq('client_id', clientId!)
        .eq('is_deleted', false)
        .order('name');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const queueName = useMemo(() => {
    const map: Record<string, string> = { sem_fila: 'Sem fila' };
    queues.forEach((q) => { map[q.id] = q.name; });
    return map;
  }, [queues]);

  const statuses = useMemo<BulkTransferStatus[]>(() => {
    const s: BulkTransferStatus[] = [];
    if (statusPending) s.push('pending');
    if (statusOpen) s.push('open');
    return s;
  }, [statusOpen, statusPending]);

  const filters: BulkTransferFilters | null = useMemo(() => {
    if (!clientId || statuses.length === 0) return null;
    if (targetType === 'assign' && !targetMember) return null;
    const member = members.find((m) => m.name === targetMember);
    const memberId = member ? Number(member.id) : NaN;
    return {
      client_id: clientId,
      start: start ? startOfDayISO(start) : null,
      end: end ? endOfDayISO(end) : null,
      queue_id: queueId === 'all' ? null : queueId,
      current_assignee: currentAssignee,
      statuses,
      target: targetType === 'assign'
        ? {
            type: 'assign',
            assigned_to: targetMember,
            assigned_user_id: Number.isFinite(memberId) ? memberId : null,
          }
        : { type: 'return_queue' },
      actor_name: user?.name ?? 'Operador',
      actor_user_id: user?.id ? Number(user.id) : null,
    };
  }, [clientId, start, end, queueId, currentAssignee, statuses, targetType, targetMember, members, user]);

  const resetForm = () => {
    setStart(undefined); setEnd(undefined); setQueueId('all');
    setCurrentAssignee('all'); setStatusOpen(true); setStatusPending(true);
    setTargetType('assign'); setTargetMember(null);
  };

  const handleAnalyze = () => {
    if (!filters) return;
    previewMutation.mutate(filters, {
      onError: (e: any) => toast.error('Erro ao analisar', { description: String(e?.message ?? e) }),
    });
  };

  const handleCommit = () => {
    if (!filters) return;
    commitMutation.mutate(filters, {
      onSuccess: (res) => {
        if (res.blocked || res.transferred === 0) {
          toast.warning('Nenhuma conversa foi transferida', {
            description:
              res.capacity_message ??
              'O atendente de destino está sem vagas disponíveis no limite de atendimentos.',
          });
          setConfirmOpen(false);
          previewMutation.reset();
          return;
        }
        toast.success(
          targetType === 'assign'
            ? `${res.transferred} conversa(s) transferida(s)`
            : `${res.transferred} conversa(s) devolvida(s) à fila`,
          { description: res.skipped > 0 ? `${res.skipped} ignorada(s) por alteração concorrente` : undefined },
        );
        setConfirmOpen(false);
        previewMutation.reset();
        resetForm();
      },
      onError: (e: any) => toast.error('Erro ao transferir', { description: String(e?.message ?? e) }),
    });
  };

  const actionLabel = targetType === 'assign' ? 'transferidas' : 'devolvidas à fila';

  return (
    <div className="border rounded-xl bg-card shadow-sm overflow-hidden max-w-2xl">
      <div className="px-5 py-4 border-b bg-muted/40 flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-sky-500/15 text-sky-600 dark:text-sky-400 flex-shrink-0">
          <ArrowRightLeft className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Transferência em lote de conversas</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
            Passe múltiplos atendimentos <span className="font-medium text-foreground/80">em aberto</span> para outro atendente ou devolva todos para a fila.
          </p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Destino */}
        <div className="space-y-2">
          <Label className="text-[12px] font-medium uppercase tracking-wide text-foreground/80">Destino</Label>
          <RadioGroup
            value={targetType}
            onValueChange={(v) => { setTargetType(v as TargetType); previewMutation.reset(); }}
            className="grid grid-cols-1 gap-1.5"
          >
            <label
              htmlFor="target-assign"
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-[13px] transition-colors',
                targetType === 'assign' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
              )}
            >
              <RadioGroupItem id="target-assign" value="assign" />
              <span className="font-medium">Outro atendente</span>
              <span className="text-[11px] text-muted-foreground ml-auto">Define um responsável único</span>
            </label>
            <label
              htmlFor="target-return"
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-[13px] transition-colors',
                targetType === 'return_queue' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
              )}
            >
              <RadioGroupItem id="target-return" value="return_queue" />
              <span className="font-medium">Devolver para a fila</span>
              <span className="text-[11px] text-muted-foreground ml-auto">Volta para "Aguardando"</span>
            </label>
          </RadioGroup>
        </div>

        {targetType === 'assign' && (
          <div className="space-y-2">
            <Label className="text-[12px] font-medium uppercase tracking-wide text-foreground/80">Transferir para</Label>
            <TeamMemberSelect
              members={members}
              value={targetMember}
              onValueChange={(v) => { setTargetMember(v); previewMutation.reset(); }}
              valueKey="name"
              allowUnassigned={false}
              showCurrentUserShortcut
              placeholder="Selecione um membro da equipe…"
              className="w-full"
              memberCounts={assignedCounts}
            />
          </div>
        )}

        {/* Filtros */}
        <div className="grid grid-cols-2 gap-3">
          <DateField label="Data início (opcional)" value={start} onChange={(d) => { setStart(d); previewMutation.reset(); }} />
          <DateField label="Data fim (opcional)" value={end} onChange={(d) => { setEnd(d); previewMutation.reset(); }} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-[12px] font-medium uppercase tracking-wide text-foreground/80">Fila</Label>
            <Select value={queueId} onValueChange={(v) => { setQueueId(v); previewMutation.reset(); }}>
              <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as filas</SelectItem>
                {queues.map((q) => (
                  <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[12px] font-medium uppercase tracking-wide text-foreground/80">Responsável atual</Label>
            <Select value={currentAssignee} onValueChange={(v) => { setCurrentAssignee(v); previewMutation.reset(); }}>
              <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="unassigned">Sem responsável (Julia)</SelectItem>
                {members.map((m) => (
                  <SelectItem key={String(m.id)} value={m.name}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[12px] font-medium uppercase tracking-wide text-foreground/80">Status</Label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-[13px] cursor-pointer">
              <Checkbox
                checked={statusPending}
                onCheckedChange={(v) => { setStatusPending(!!v); previewMutation.reset(); }}
              />
              Aguardando
            </label>
            <label className="flex items-center gap-2 text-[13px] cursor-pointer">
              <Checkbox
                checked={statusOpen}
                onCheckedChange={(v) => { setStatusOpen(!!v); previewMutation.reset(); }}
              />
              Em atendimento
            </label>
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className="rounded-md border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-medium uppercase tracking-wide text-foreground/80">Resultado da análise</div>
              {preview.capped && <Badge variant="outline" className="text-[10px]">Limite de 20.000 atingido</Badge>}
            </div>
            <div className="text-3xl font-bold tabular-nums">
              {(preview.will_transfer ?? preview.total).toLocaleString('pt-BR')}
              <span className="text-[12px] font-normal text-muted-foreground ml-2">
                conversa(s) seriam {actionLabel}
              </span>
            </div>

            {targetType === 'assign' && preview.capacity && (preview.overflow ?? 0) > 0 && (
              <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
                {preview.capacity_message ??
                  `O atendente de destino tem ${preview.capacity.slots ?? 0} vaga(s) livre(s) (${preview.capacity.load}/${preview.capacity.max_concurrent}). ` +
                    `${(preview.overflow ?? 0).toLocaleString('pt-BR')} de ${preview.total.toLocaleString('pt-BR')} conversa(s) ficarão de fora.`}
              </div>
            )}

            {preview.total > 0 && (
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                {preview.oldest && (
                  <div className="rounded border bg-background px-3 py-2 col-span-2">
                    <div className="text-muted-foreground text-[11px]">Período aberto</div>
                    <div className="text-[12px]">
                      {format(new Date(preview.oldest), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      {' → '}
                      {format(new Date(preview.newest!), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </div>
                  </div>
                )}
                {Object.keys(preview.byAssignee).length > 0 && (
                  <div className="col-span-2 space-y-1">
                    <div className="text-[11px] text-muted-foreground">Por responsável atual</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(preview.byAssignee)
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => (
                          <Badge key={k} variant="secondary" className="text-[11px]">{k} · {v}</Badge>
                        ))}
                    </div>
                  </div>
                )}
                {Object.keys(preview.byQueue).length > 0 && (
                  <div className="col-span-2 space-y-1">
                    <div className="text-[11px] text-muted-foreground">Por fila</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(preview.byQueue)
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => (
                          <Badge key={k} variant="secondary" className="font-mono text-[11px]">
                            {queueName[k] ?? 'Fila'} · {v}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t bg-muted/20 flex items-center justify-between gap-3">
        <div className="text-[11px] text-muted-foreground">
          Sem datas, considera <strong>todo o período</strong>. Só afeta conversas abertas ou aguardando.
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={!filters || previewMutation.isPending} onClick={handleAnalyze}>
            {previewMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Analisar conversas
          </Button>
          <Button
            size="sm"
            disabled={!preview || (preview.will_transfer ?? preview.total) === 0 || commitMutation.isPending}
            onClick={() => { setConfirmStep(1); setUnderstood(false); setConfirmOpen(true); }}
          >
            {targetType === 'assign' ? 'Transferir conversas' : 'Devolver para a fila'}
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {confirmStep === 1 ? 'Confirmar transferência em lote' : 'Última confirmação'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {confirmStep === 1 ? (
                  <>
                    <p>
                      Você está prestes a {targetType === 'assign' ? 'transferir' : 'devolver à fila'}{' '}
                      <strong>{preview?.total.toLocaleString('pt-BR')}</strong> conversa(s)
                      {targetType === 'assign' && <> para <strong>{targetMember}</strong></>}.
                    </p>
                    <p className="text-muted-foreground">
                      Cada conversa receberá um registro no histórico identificando você como responsável pela ação em lote.
                    </p>
                    <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
                      <div>
                        <div className="font-medium">Estou ciente desta ação</div>
                        <div className="text-[11px] text-muted-foreground">Ative para liberar a etapa final</div>
                      </div>
                      <Switch checked={understood} onCheckedChange={setUnderstood} />
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-amber-900 dark:text-amber-200">
                    <div className="font-semibold mb-1">Atenção: ação em lote</div>
                    <div className="text-[12px]">
                      Confirme novamente para {targetType === 'assign' ? 'transferir' : 'devolver'}{' '}
                      <strong>{preview?.total.toLocaleString('pt-BR')}</strong> conversa(s).
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={commitMutation.isPending}>Cancelar</AlertDialogCancel>
            {confirmStep === 1 ? (
              <AlertDialogAction
                disabled={!understood}
                onClick={(e) => { e.preventDefault(); setConfirmStep(2); }}
              >
                Continuar
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleCommit(); }}
                disabled={commitMutation.isPending}
              >
                {commitMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Processando…</>
                ) : targetType === 'assign' ? (
                  <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Transferir agora</>
                ) : (
                  <><Undo2 className="h-3.5 w-3.5 mr-1.5" /> Devolver agora</>
                )}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: Date | undefined; onChange: (d?: Date) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-medium uppercase tracking-wide text-foreground/80">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-full justify-start h-9 text-[13px] font-normal', !value && 'text-muted-foreground')}>
            <CalendarIcon className="h-3.5 w-3.5 mr-2" />
            {value ? format(value, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus locale={ptBR} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
