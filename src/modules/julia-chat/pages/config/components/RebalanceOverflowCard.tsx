/**
 * Devolver excedente à fila — libera atendentes que estão acima do teto,
 * devolvendo à fila as conversas mais paradas até respeitar o limite.
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Scale, Undo2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useRebalanceOverflow } from '@/hooks/useRebalanceOverflow';

const IDLE_OPTIONS = [
  { value: '0', label: 'Sem filtro de inatividade' },
  { value: '2', label: 'Sem resposta há 2h+' },
  { value: '12', label: 'Sem resposta há 12h+' },
  { value: '24', label: 'Sem resposta há 24h+' },
  { value: '72', label: 'Sem resposta há 3 dias+' },
];

export function RebalanceOverflowCard() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : null;

  const [idleHours, setIdleHours] = useState('0');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [understood, setUnderstood] = useState(false);

  const { previewMutation, commitMutation } = useRebalanceOverflow();
  const preview = previewMutation.data;

  const params = {
    client_id: clientId ?? '',
    actor_name: user?.name ?? 'Sistema',
    actor_user_id: user?.id ? Number(user.id) : null,
    min_idle_hours: Number(idleHours) || 0,
  };

  const handlePreview = async () => {
    if (!clientId) return;
    try {
      const res = await previewMutation.mutateAsync(params);
      if (res.total_overflow === 0) toast.success('Nenhum atendente acima do limite.');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao calcular excedente');
    }
  };

  const handleCommit = async () => {
    try {
      const res = await commitMutation.mutateAsync(params);
      toast.success(`${res.total_returned} conversa(s) devolvida(s) à fila`);
      setConfirmOpen(false);
      setConfirmStep(1);
      setUnderstood(false);
      await previewMutation.mutateAsync(params);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao devolver excedente');
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-start gap-2">
        <Scale className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold">Devolver excedente à fila</h3>
          <p className="text-xs text-muted-foreground">
            Atendentes acima do limite têm as conversas mais paradas devolvidas à fila,
            até respeitarem o teto configurado.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:max-w-xs">
        <Label className="text-xs">Escolher conversas</Label>
        <Select value={idleHours} onValueChange={setIdleHours}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {IDLE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handlePreview} disabled={!clientId || previewMutation.isPending}>
          {previewMutation.isPending
            ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
          Calcular excedente
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={!preview || preview.total_candidates === 0 || commitMutation.isPending}
          onClick={() => { setConfirmStep(1); setUnderstood(false); setConfirmOpen(true); }}
        >
          <Undo2 className="h-3.5 w-3.5 mr-1.5" />
          Devolver à fila
        </Button>
      </div>

      {preview && (
        <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2 text-xs">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{preview.agents.length} atendente(s) acima do limite</Badge>
            <Badge variant="outline">Excedente: {preview.total_overflow}</Badge>
            <Badge variant="outline">Serão devolvidas: {preview.total_candidates}</Badge>
          </div>
          {preview.agents.length === 0 ? (
            <p className="text-muted-foreground">Todos os atendentes estão dentro do limite.</p>
          ) : (
            <ul className="space-y-1">
              {preview.agents.map((a) => (
                <li key={a.agent_identifier} className="flex items-center justify-between gap-2">
                  <span className="truncate">{a.agent_name || `Atendente ${a.agent_identifier}`}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {a.load}/{a.max_concurrent} · devolver {a.candidates} de {a.overflow}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {preview.total_candidates < preview.total_overflow && (
            <p className="flex items-start gap-1.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Menos conversas elegíveis que o excedente — reduza o filtro de inatividade para devolver mais.
            </p>
          )}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmStep === 1 ? 'Devolver excedente à fila?' : 'Confirmação final'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmStep === 1 ? (
                <>
                  {preview?.total_candidates ?? 0} conversa(s) perderão o responsável e voltarão
                  para o status "aguardando" na fila de origem. A ação é registrada no histórico.
                </>
              ) : (
                <>Esta ação não pode ser desfeita automaticamente.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmStep === 2 && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={understood} onCheckedChange={(v) => setUnderstood(!!v)} />
              Entendi e quero devolver {preview?.total_candidates ?? 0} conversa(s) à fila.
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setConfirmStep(1); setUnderstood(false); }}>
              Cancelar
            </AlertDialogCancel>
            {confirmStep === 1 ? (
              <Button onClick={() => setConfirmStep(2)}>Continuar</Button>
            ) : (
              <AlertDialogAction
                disabled={!understood || commitMutation.isPending}
                onClick={(e) => { e.preventDefault(); void handleCommit(); }}
              >
                {commitMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Devolver agora
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
