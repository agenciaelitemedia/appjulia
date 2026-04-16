import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { toast } from 'sonner';

interface ScheduleMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  clientId: string;
  codAgent?: string | null;
  conversationId?: string | null;
  initialText?: string;
}

function defaultDateTime(): string {
  const d = new Date(Date.now() + 30 * 60 * 1000); // +30 min
  d.setSeconds(0, 0);
  // YYYY-MM-DDTHH:mm in local time for input[type=datetime-local]
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleMessageDialog({
  open,
  onOpenChange,
  contactId,
  clientId,
  codAgent,
  conversationId,
  initialText = '',
}: ScheduleMessageDialogProps) {
  const { user } = useAuth();
  const { refreshScheduled } = useWhatsAppData();
  const [text, setText] = useState(initialText);
  const [when, setWhen] = useState<string>(defaultDateTime());
  const [saving, setSaving] = useState(false);

  const handleSchedule = async () => {
    if (!text.trim()) {
      toast.error('Digite o texto da mensagem');
      return;
    }
    const dt = new Date(when);
    if (isNaN(dt.getTime()) || dt.getTime() < Date.now() + 30_000) {
      toast.error('Escolha uma data futura (>30s)');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('chat_scheduled_messages').insert({
        client_id: clientId,
        cod_agent: codAgent,
        contact_id: contactId,
        conversation_id: conversationId,
        text: text.trim(),
        scheduled_for: dt.toISOString(),
        created_by: user?.id ? String(user.id) : null,
        created_by_name: user?.name || null,
      });
      if (error) throw error;
      toast.success(`Agendada para ${dt.toLocaleString('pt-BR')}`);
      setText('');
      onOpenChange(false);
      refreshScheduled?.(contactId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao agendar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Agendar mensagem
          </DialogTitle>
          <DialogDescription>
            A mensagem será enviada automaticamente no horário escolhido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="sched-text">Mensagem</Label>
            <Textarea
              id="sched-text"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Digite a mensagem a enviar…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sched-when">Quando enviar</Label>
            <Input
              id="sched-when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSchedule} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
