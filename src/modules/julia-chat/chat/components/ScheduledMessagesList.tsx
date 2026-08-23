import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Calendar, Trash2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ScheduledRow {
  id: string;
  text: string | null;
  caption: string | null;
  media_url: string | null;
  scheduled_for: string;
  status: string;
  last_error: string | null;
  attempts: number;
  created_by_name: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
}

export function ScheduledMessagesList({ open, onOpenChange, contactId }: Props) {
  const [items, setItems] = useState<ScheduledRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_scheduled_messages')
      .select('id,text,caption,media_url,scheduled_for,status,last_error,attempts,created_by_name')
      .eq('contact_id', contactId)
      .order('scheduled_for', { ascending: true });
    if (!error) setItems((data || []) as ScheduledRow[]);
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const cancel = async (id: string) => {
    const { error } = await supabase
      .from('chat_scheduled_messages')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('status', 'pending');
    if (error) {
      toast.error('Não foi possível cancelar');
    } else {
      toast.success('Agendamento cancelado');
      load();
    }
  };

  const renderStatus = (s: string) => {
    if (s === 'pending') return <Badge variant="outline" className="border-yellow-500/40 text-yellow-700">Pendente</Badge>;
    if (s === 'sent') return <Badge variant="outline" className="border-emerald-500/40 text-emerald-700">Enviada</Badge>;
    if (s === 'failed') return <Badge variant="outline" className="border-destructive/40 text-destructive">Falhou</Badge>;
    if (s === 'cancelled') return <Badge variant="outline" className="text-muted-foreground">Cancelada</Badge>;
    return <Badge variant="outline">{s}</Badge>;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Mensagens agendadas
          </SheetTitle>
          <SheetDescription>
            Gerencie envios programados deste contato.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
            </div>
          )}

          {!loading && items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma mensagem agendada.
            </p>
          )}

          {items.map((it) => {
            const dt = new Date(it.scheduled_for);
            const isPast = dt.getTime() < Date.now();
            return (
              <div key={it.id} className="border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  {renderStatus(it.status)}
                  <span className="text-xs text-muted-foreground">
                    {dt.toLocaleString('pt-BR')}
                  </span>
                </div>

                <p className="text-sm whitespace-pre-wrap break-words">
                  {it.text || it.caption || (it.media_url ? '[mídia]' : '—')}
                </p>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-muted-foreground">
                    {it.created_by_name && `por ${it.created_by_name} • `}
                    {it.status === 'pending'
                      ? (isPast ? 'enviando em breve…' : `em ${formatDistanceToNow(dt, { locale: ptBR })}`)
                      : it.attempts > 0 ? `${it.attempts} tentativa(s)` : ''}
                  </span>
                  {it.status === 'pending' && (
                    <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={() => cancel(it.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Cancelar
                    </Button>
                  )}
                </div>

                {it.status === 'failed' && it.last_error && (
                  <div className="flex items-start gap-1.5 text-[11px] text-destructive bg-destructive/5 p-1.5 rounded">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span className="break-all">{it.last_error}</span>
                  </div>
                )}

                {it.status === 'sent' && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Entregue ao contato
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
