import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowRightLeft, CalendarIcon, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamByClient } from '@/hooks/useTeamByClient';
import { Queue } from '../hooks/useQueues';
import {
  useQueueConversationMigration,
  type QueueMigrationInput,
  type QueueMigrationStatus,
} from '@/hooks/useQueueConversationMigration';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue: Queue;
  otherQueues: Queue[];
}

const STATUS_OPTIONS: Array<{ value: QueueMigrationStatus; label: string }> = [
  { value: 'pending', label: 'Aguardando atendimento' },
  { value: 'open', label: 'Em atendimento' },
  { value: 'resolved', label: 'Concluídas' },
  { value: 'closed', label: 'Encerradas' },
];

const ALL_STATUSES = STATUS_OPTIONS.map((s) => s.value);

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando',
  open: 'Em atendimento',
  resolved: 'Concluída',
  closed: 'Encerrada',
};

function startOfDayISO(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x.toISOString();
}
function endOfDayISO(d: Date) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x.toISOString();
}

export function MigrateQueueConversationsDialog({ open, onOpenChange, queue, otherQueues }: Props) {
  const { user } = useAuth();
  const { data: team } = useTeamByClient();
  const { analyzeMutation, commitMutation } = useQueueConversationMigration();
  const analysis = analyzeMutation.data;

  const [toQueueId, setToQueueId] = useState('');
  const [scope, setScope] = useState<'all' | 'filter'>('all');
  const [statuses, setStatuses] = useState<QueueMigrationStatus[]>(ALL_STATUSES);
  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [assigneeMode, setAssigneeMode] = useState<'keep' | 'return_queue'>('keep');
  const [moveContacts, setMoveContacts] = useState(true);

  const [confirmName, setConfirmName] = useState('');
  const [understood, setUnderstood] = useState(false);

  const members = useMemo(() => (team || []).map((m) => ({ id: m.id, name: m.name })), [team]);

  const resetAll = () => {
    setToQueueId('');
    setScope('all');
    setStatuses(ALL_STATUSES);
    setStart(undefined);
    setEnd(undefined);
    setAssignedFilter('all');
    setAssigneeMode('keep');
    setMoveContacts(true);
    setConfirmName('');
    setUnderstood(false);
    analyzeMutation.reset();
    commitMutation.reset();
  };

  useEffect(() => {
    if (!open) resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Qualquer mudança nos filtros invalida a análise anterior.
  const invalidateAnalysis = () => {
    if (analyzeMutation.data) analyzeMutation.reset();
    setConfirmName('');
    setUnderstood(false);
  };

  const effectiveStatuses = scope === 'all' ? ALL_STATUSES : statuses;

  const input: QueueMigrationInput | null = useMemo(() => {
    if (!queue.client_id || !toQueueId || effectiveStatuses.length === 0) return null;
    return {
      client_id: String(queue.client_id),
      from_queue_id: queue.id,
      to_queue_id: toQueueId,
      statuses: effectiveStatuses,
      start: scope === 'filter' && start ? startOfDayISO(start) : null,
      end: scope === 'filter' && end ? endOfDayISO(end) : null,
      assigned_filter: scope === 'filter' ? assignedFilter : 'all',
      assignee_mode: assigneeMode,
      move_contacts: moveContacts,
      actor_name: user?.name || user?.email || 'Operador',
      actor_user_id: user?.id ? Number(user.id) : null,
    };
  }, [queue.client_id, queue.id, toQueueId, effectiveStatuses, scope, start, end, assignedFilter, assigneeMode, moveContacts, user]);

  const targetQueueName = otherQueues.find((q) => q.id === toQueueId)?.name ?? '';
  const nameMatches = confirmName.trim().toLowerCase() === queue.name.trim().toLowerCase();
  const canMigrate = !!analysis && analysis.total > 0 && nameMatches && understood;

  const toggleStatus = (value: QueueMigrationStatus, checked: boolean) => {
    setStatuses((prev) => (checked ? Array.from(new Set([...prev, value])) : prev.filter((s) => s !== value)));
    invalidateAnalysis();
  };

  const handleAnalyze = () => {
    if (!input) return;
    analyzeMutation.mutate(input, {
      onError: (e: any) => toast.error('Erro ao analisar', { description: String(e?.message ?? e) }),
    });
  };

  const handleMigrate = () => {
    if (!input || !canMigrate) return;
    commitMutation.mutate(input, {
      onSuccess: (res) => {
        if (res.migrated === 0) {
          toast.warning('Nenhuma conversa foi migrada', {
            description: 'As conversas podem ter mudado de estado desde a análise.',
          });
        } else {
          toast.success(`${res.migrated} conversa(s) migrada(s) para ${targetQueueName}`, {
            description: [
              res.skipped > 0 ? `${res.skipped} ignorada(s)` : null,
              res.contacts_moved > 0 ? `${res.contacts_moved} contato(s) movido(s)` : null,
            ].filter(Boolean).join(' · ') || undefined,
          });
        }
        onOpenChange(false);
      },
      onError: (e: any) => toast.error('Erro ao migrar', { description: String(e?.message ?? e) }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-sky-600" />
            Migrar conversas de {queue.name}
          </DialogTitle>
          <DialogDescription>
            Move as conversas desta fila para outra fila do escritório. O histórico de cada conversa registra a migração.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Destino */}
          <div className="space-y-2">
            <Label>Fila de destino <span className="text-destructive">*</span></Label>
            {otherQueues.length === 0 ? (
              <p className="text-xs text-destructive">Nenhuma outra fila ativa disponível para receber as conversas.</p>
            ) : (
              <Select value={toQueueId} onValueChange={(v) => { setToQueueId(v); invalidateAnalysis(); }}>
                <SelectTrigger><SelectValue placeholder="Selecione a fila de destino" /></SelectTrigger>
                <SelectContent>
                  {otherQueues.map((q) => (
                    <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Escopo */}
          <div className="space-y-2">
            <Label>O que migrar</Label>
            <RadioGroup
              value={scope}
              onValueChange={(v) => { setScope(v as 'all' | 'filter'); invalidateAnalysis(); }}
              className="grid gap-1.5"
            >
              <label
                htmlFor="scope-all"
                className={cn('flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm',
                  scope === 'all' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}
              >
                <RadioGroupItem id="scope-all" value="all" />
                <span className="font-medium">Todas as conversas</span>
                <span className="text-[11px] text-muted-foreground ml-auto">Encerradas, aguardando e em atendimento</span>
              </label>
              <label
                htmlFor="scope-filter"
                className={cn('flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm',
                  scope === 'filter' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}
              >
                <RadioGroupItem id="scope-filter" value="filter" />
                <span className="font-medium">Filtrar</span>
                <span className="text-[11px] text-muted-foreground ml-auto">Status, período e responsável</span>
              </label>
            </RadioGroup>
          </div>

          {scope === 'filter' && (
            <div className="space-y-4 rounded-md border bg-muted/20 p-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={statuses.includes(s.value)}
                        onCheckedChange={(v) => toggleStatus(s.value, !!v)}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DateField label="Data início" value={start} onChange={(d) => { setStart(d); invalidateAnalysis(); }} />
                <DateField label="Data fim" value={end} onChange={(d) => { setEnd(d); invalidateAnalysis(); }} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Usuário atribuído</Label>
                <Select value={assignedFilter} onValueChange={(v) => { setAssignedFilter(v); invalidateAnalysis(); }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
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
          )}

          {/* Responsável após a migração */}
          <div className="space-y-2">
            <Label>Responsável após a migração</Label>
            <RadioGroup
              value={assigneeMode}
              onValueChange={(v) => { setAssigneeMode(v as 'keep' | 'return_queue'); invalidateAnalysis(); }}
              className="grid gap-1.5"
            >
              <label
                htmlFor="mode-keep"
                className={cn('flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm',
                  assigneeMode === 'keep' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}
              >
                <RadioGroupItem id="mode-keep" value="keep" />
                <span className="font-medium">Manter o responsável atual</span>
              </label>
              <label
                htmlFor="mode-return"
                className={cn('flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm',
                  assigneeMode === 'return_queue' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}
              >
                <RadioGroupItem id="mode-return" value="return_queue" />
                <span className="font-medium">Devolver para a fila</span>
                <span className="text-[11px] text-muted-foreground ml-auto">Volta para "Aguardando"</span>
              </label>
            </RadioGroup>
          </div>

          <div className="flex items-start gap-3 rounded-md border p-3">
            <Switch checked={moveContacts} onCheckedChange={(v) => { setMoveContacts(v); invalidateAnalysis(); }} />
            <div className="text-xs">
              <Label className="text-foreground cursor-pointer">Mover também o contato para a fila de destino</Label>
              <p className="text-muted-foreground mt-1">
                Novas mensagens do lead passam a chegar direto na fila de destino.
              </p>
            </div>
          </div>

          {/* Resultado da análise */}
          {analysis && (
            <div className="rounded-md border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Resultado da análise</div>
                {analysis.capped && <Badge variant="outline" className="text-[10px]">Limite de 50.000 atingido</Badge>}
              </div>
              <div className="text-3xl font-bold tabular-nums">
                {analysis.total.toLocaleString('pt-BR')}
                <span className="text-xs font-normal text-muted-foreground ml-2">conversa(s) serão migradas</span>
              </div>
              {moveContacts && analysis.contacts > 0 && (
                <div className="text-xs text-muted-foreground">
                  {analysis.contacts.toLocaleString('pt-BR')} contato(s) serão movidos para {targetQueueName}.
                </div>
              )}
              {analysis.oldest && (
                <div className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="text-muted-foreground text-[11px]">Período</div>
                  {format(new Date(analysis.oldest), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  {' → '}
                  {format(new Date(analysis.newest!), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </div>
              )}
              {Object.keys(analysis.byStatus).length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] text-muted-foreground">Por status</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(analysis.byStatus).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                      <Badge key={k} variant="secondary" className="text-[11px]">{STATUS_LABEL[k] ?? k} · {v}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {Object.keys(analysis.byAssignee).length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] text-muted-foreground">Por responsável</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(analysis.byAssignee).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                      <Badge key={k} variant="secondary" className="text-[11px]">{k} · {v}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {analysis.total === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma conversa corresponde aos filtros escolhidos.</p>
              )}
            </div>
          )}

          {/* Tripla confirmação */}
          {analysis && analysis.total > 0 && (
            <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                <p className="text-xs text-amber-900 dark:text-amber-200">
                  Esta ação move {analysis.total.toLocaleString('pt-BR')} conversa(s) de <strong>{queue.name}</strong> para{' '}
                  <strong>{targetQueueName}</strong> e não pode ser desfeita automaticamente.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">
                  Digite <strong>{queue.name}</strong> para confirmar:
                </Label>
                <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={queue.name} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={understood} onCheckedChange={setUnderstood} disabled={!nameMatches} />
                <Label className="text-sm cursor-pointer">Estou ciente e desejo migrar as conversas</Label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={commitMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={handleAnalyze}
            disabled={!input || analyzeMutation.isPending || commitMutation.isPending}
          >
            {analyzeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Analisar
          </Button>
          <Button onClick={handleMigrate} disabled={!canMigrate || commitMutation.isPending}>
            {commitMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Migrando…</>
              : <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar migração</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DateField({ label, value, onChange }: { label: string; value?: Date; onChange: (d?: Date) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-full justify-start h-9 text-sm font-normal', !value && 'text-muted-foreground')}>
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
