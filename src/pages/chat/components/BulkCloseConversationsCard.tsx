import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, XCircle, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useBulkCloseConversations,
  type BulkCloseScope,
  type BulkCloseFilters,
} from '@/hooks/useBulkCloseConversations';

const SCOPES: { value: BulkCloseScope; label: string; hint: string }[] = [
  { value: 'all', label: 'Todos os chats', hint: 'Julia + atendimento humano' },
  { value: 'julia', label: 'Apenas Julia (IA)', hint: 'Conversas sem responsável' },
  { value: 'human', label: 'Apenas humano', hint: 'Conversas com responsável atribuído' },
];

function startOfDayISO(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x.toISOString();
}
function endOfDayISO(d: Date) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x.toISOString();
}

export function BulkCloseConversationsCard() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : null;

  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const [scope, setScope] = useState<BulkCloseScope>('all');
  const [queueId, setQueueId] = useState<string>('all');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [understood, setUnderstood] = useState(false);

  const { previewMutation, commitMutation } = useBulkCloseConversations();
  const preview = previewMutation.data;

  const { data: queues = [] } = useQuery({
    queryKey: ['bulk-close-queues', clientId],
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

  const filters: BulkCloseFilters | null = useMemo(() => {
    if (!clientId || !start || !end) return null;
    return {
      client_id: clientId,
      start: startOfDayISO(start),
      end: endOfDayISO(end),
      scope,
      queue_id: queueId === 'all' ? null : queueId,
      actor_identifier: user?.cod_agent ? String(user.cod_agent) : (user?.email ?? null),
      actor_name: user?.name ?? 'Operador',
    };
  }, [clientId, start, end, scope, queueId, user]);

  const canAnalyze = !!filters && !previewMutation.isPending;

  const handleAnalyze = () => {
    if (!filters) return;
    previewMutation.mutate(filters, {
      onError: (e: any) => toast.error('Erro ao analisar', { description: String(e?.message ?? e) }),
    });
  };

  const openConfirm = () => {
    setConfirmStep(1);
    setUnderstood(false);
    setConfirmOpen(true);
  };

  const handleCommit = () => {
    if (!filters) return;
    commitMutation.mutate(filters, {
      onSuccess: (res) => {
        toast.success(`${res.closed} conversa(s) encerrada(s)`, {
          description: res.skipped > 0 ? `${res.skipped} ignorada(s) por alteração concorrente` : undefined,
        });
        setConfirmOpen(false);
        previewMutation.reset();
        setStart(undefined); setEnd(undefined); setScope('all'); setQueueId('all');
      },
      onError: (e: any) => toast.error('Erro ao encerrar', { description: String(e?.message ?? e) }),
    });
  };

  return (
    <div className="border rounded-xl bg-card shadow-sm overflow-hidden max-w-2xl">
      <div className="px-5 py-4 border-b bg-muted/40 flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-rose-500/15 text-rose-600 dark:text-rose-400 flex-shrink-0">
          <XCircle className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Encerramento em lote de conversas</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
            Feche múltiplas conversas <span className="font-medium text-foreground/80">em aberto</span> em um intervalo de datas. Use com cuidado.
          </p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Datas */}
        <div className="grid grid-cols-2 gap-3">
          <DateField label="Data início" value={start} onChange={setStart} />
          <DateField label="Data fim" value={end} onChange={setEnd} />
        </div>

        {/* Escopo */}
        <div className="space-y-2">
          <Label className="text-[12px] font-medium uppercase tracking-wide text-foreground/80">Escopo</Label>
          <RadioGroup value={scope} onValueChange={(v) => setScope(v as BulkCloseScope)} className="grid grid-cols-1 gap-1.5">
            {SCOPES.map((s) => (
              <label
                key={s.value}
                htmlFor={`scope-${s.value}`}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-[13px] transition-colors',
                  scope === s.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                )}
              >
                <RadioGroupItem id={`scope-${s.value}`} value={s.value} />
                <span className="font-medium">{s.label}</span>
                <span className="text-[11px] text-muted-foreground ml-auto">{s.hint}</span>
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Fila */}
        <div className="space-y-2">
          <Label className="text-[12px] font-medium uppercase tracking-wide text-foreground/80">Fila</Label>
          <Select value={queueId} onValueChange={setQueueId}>
            <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as filas</SelectItem>
              {queues.map((q) => (
                <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Preview */}
        {preview && (
          <div className="rounded-md border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-medium uppercase tracking-wide text-foreground/80">Resultado da análise</div>
              {preview.capped && (
                <Badge variant="outline" className="text-[10px]">Limite de 20.000 atingido</Badge>
              )}
            </div>
            <div className="text-3xl font-bold tabular-nums">
              {preview.total.toLocaleString('pt-BR')}
              <span className="text-[12px] font-normal text-muted-foreground ml-2">conversa(s) seriam encerradas</span>
            </div>

            {preview.total > 0 && (
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded border bg-background px-3 py-2">
                  <div className="text-muted-foreground">Julia (IA)</div>
                  <div className="font-semibold tabular-nums">{preview.byAssignment.julia.toLocaleString('pt-BR')}</div>
                </div>
                <div className="rounded border bg-background px-3 py-2">
                  <div className="text-muted-foreground">Atendimento humano</div>
                  <div className="font-semibold tabular-nums">{preview.byAssignment.human.toLocaleString('pt-BR')}</div>
                </div>
                {preview.oldest && (
                  <div className="rounded border bg-background px-3 py-2 col-span-2">
                    <div className="text-muted-foreground text-[11px]">Período aberto</div>
                    <div className="text-[12px]">
                      {format(new Date(preview.oldest), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      {' → '}
                      {format(new Date(preview.newest!), "dd/MM/yyyy HH:mm", { locale: ptBR })}
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
          Filtra por <code>opened_at</code> entre as datas e somente conversas <strong>abertas ou pendentes</strong>.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            disabled={!canAnalyze}
            onClick={handleAnalyze}
          >
            {previewMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Analisar conversas
          </Button>
          <Button
            size="sm" variant="destructive"
            disabled={!preview || preview.total === 0 || commitMutation.isPending}
            onClick={openConfirm}
          >
            Encerrar conversas
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {confirmStep === 1 ? 'Confirmar encerramento em lote' : 'Última confirmação'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {confirmStep === 1 ? (
                  <>
                    <p>
                      Você está prestes a encerrar <strong>{preview?.total.toLocaleString('pt-BR')}</strong> conversa(s).
                      Elas <strong>sairão da lista "Em aberto"</strong> e ficarão como <strong>encerradas</strong>.
                    </p>
                    <p className="text-muted-foreground">
                      Cada conversa receberá uma nota no histórico identificando você como responsável pelo encerramento, e a ação ficará registrada no log de auditoria.
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
                  <>
                    <div className="rounded-md border border-rose-300 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900 p-3 text-rose-900 dark:text-rose-200">
                      <div className="font-semibold mb-1">Atenção: ação irreversível em lote</div>
                      <div className="text-[12px]">
                        Confirme novamente o encerramento de <strong>{preview?.total.toLocaleString('pt-BR')}</strong> conversa(s).
                      </div>
                    </div>
                  </>
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
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {commitMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Encerrando…</>
                ) : (
                  <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Encerrar agora</>
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
            {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : 'Selecionar'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus locale={ptBR} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
