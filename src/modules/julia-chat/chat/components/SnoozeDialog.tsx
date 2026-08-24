import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SnoozeDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string | null;
  onSnoozed?: (conversationId: string) => void;
}

const PRESETS: Array<{ label: string; minutes: number }> = [
  { label: '1 hora', minutes: 60 },
  { label: '4 horas', minutes: 240 },
  { label: 'Amanhã 9h', minutes: -1 }, // special
  { label: '2 dias', minutes: 60 * 24 * 2 },
  { label: '1 semana', minutes: 60 * 24 * 7 },
];

export function SnoozeDialog({ open, onOpenChange, conversationId, onSnoozed }: SnoozeDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [customDateTime, setCustomDateTime] = useState('');
  const [loading, setLoading] = useState(false);
  /** Adiamento escolhido, aguardando confirmação. */
  const [pending, setPending] = useState<Date | null>(null);

  const computeUntil = (preset: { label: string; minutes: number }): Date => {
    if (preset.minutes === -1) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    }
    return new Date(Date.now() + preset.minutes * 60 * 1000);
  };

  const choose = (until: Date) => {
    if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
      toast.error('Data inválida', { description: 'Escolha um horário no futuro.' });
      return;
    }
    setPending(until);
  };

  const reset = () => {
    setPending(null);
    setReason('');
    setCustomDateTime('');
  };

  const handleSnooze = async (until: Date) => {
    if (!conversationId || loading) return;
    if (until.getTime() <= Date.now()) {
      toast.error('Data inválida', { description: 'Escolha um horário no futuro.' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({
          snoozed_until: until.toISOString(),
          snooze_reason: reason || null,
          snoozed_by: user?.id ? String(user.id) : null,
        })
        .eq('id', conversationId);
      if (error) throw error;
      const untilStr = until.toLocaleString('pt-BR');
      toast.success('Conversa adiada', { description: `Voltará em ${untilStr}` });
      supabase.from('chat_conversation_history').insert({
        conversation_id: conversationId,
        action: 'snoozed',
        actor_name: user?.name || user?.email || 'Sistema',
        to_value: untilStr,
        user_id: user?.id ? Number(user.id) : null,
        notes: reason || null,
      }).then();
      onSnoozed?.(conversationId);
      onOpenChange(false);
      reset();
    } catch (e) {
      toast.error('Erro ao adiar', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {pending ? 'Confirmar adiamento' : 'Adiar conversa'}
          </DialogTitle>
          <DialogDescription>
            {pending
              ? `A conversa sairá da lista e voltará em ${pending.toLocaleString('pt-BR')}.`
              : 'A conversa será ocultada e voltará automaticamente no horário escolhido.'}
          </DialogDescription>
        </DialogHeader>

        {pending ? (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Adiar até {pending.toLocaleString('pt-BR')}?</p>
              {reason ? (
                <p className="mt-1 text-xs text-muted-foreground">Motivo: {reason}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="snooze-reason-confirm" className="text-xs">Motivo (opcional)</Label>
              <Textarea
                id="snooze-reason-confirm"
                placeholder="Ex: aguardando retorno do cliente"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                disabled={loading}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  onClick={() => choose(computeUntil(p))}
                  disabled={loading}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-datetime" className="text-xs">Data/hora personalizada</Label>
              <div className="flex gap-2">
                <Input
                  id="custom-datetime"
                  type="datetime-local"
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  disabled={loading}
                />
                <Button
                  size="sm"
                  onClick={() => customDateTime && choose(new Date(customDateTime))}
                  disabled={loading || !customDateTime}
                >
                  Adiar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="snooze-reason" className="text-xs">Motivo (opcional)</Label>
              <Textarea
                id="snooze-reason"
                placeholder="Ex: aguardando retorno do cliente"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                disabled={loading}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {pending ? (
            <>
              <Button variant="ghost" onClick={() => setPending(null)} disabled={loading}>
                Voltar
              </Button>
              <Button onClick={() => handleSnooze(pending)} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar adiamento
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

