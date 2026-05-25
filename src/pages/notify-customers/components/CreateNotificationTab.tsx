import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Send, Clock } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import {
  useInternalNotifications, type NotificationType, type NotificationAudience,
  type AlertLevel,
} from '@/hooks/useInternalNotifications';
import { useAuth } from '@/contexts/AuthContext';

export function CreateNotificationTab({ onCreated }: { onCreated?: () => void }) {
  const { createAndSend } = useInternalNotifications();
  const { isAdmin } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<NotificationType>('message');
  const [audience, setAudience] = useState<NotificationAudience>(isAdmin ? 'all' : 'teams');
  const [alertLevel, setAlertLevel] = useState<AlertLevel>('info');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [when, setWhen] = useState<'now' | 'schedule'>('now');
  const [scheduledFor, setScheduledFor] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle(''); setBody(''); setType('message'); setAudience(isAdmin ? 'all' : 'teams');
    setOptions(['', '']); setWhen('now'); setScheduledFor(''); setAlertLevel('info');
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Informe um título'); return; }
    if (type === 'poll') {
      const clean = options.map((o) => o.trim()).filter(Boolean);
      if (clean.length < 2) { toast.error('A enquete precisa de ao menos 2 opções'); return; }
    }
    if (when === 'schedule' && !scheduledFor) { toast.error('Defina a data/hora do agendamento'); return; }

    setSaving(true);
    try {
      await createAndSend.mutateAsync({
        title: title.trim(),
        body: body.trim() || undefined,
        type,
        poll_options: type === 'poll' ? options.map((o) => o.trim()).filter(Boolean) : undefined,
        audience,
        scheduledFor: when === 'schedule' ? new Date(scheduledFor).toISOString() : null,
        alert_level: alertLevel,
      });
      toast.success(when === 'schedule' ? 'Notificação agendada' : 'Notificação enviada');
      reset();
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar notificação');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = () => {
    if (!title.trim()) { toast.error('Informe um título'); return; }
    window.dispatchEvent(new CustomEvent('internal-notification:test', {
      detail: {
        title: title.trim(),
        body: body.trim() || null,
        type,
        poll_options: type === 'poll' ? options.map((o) => o.trim()).filter(Boolean) : null,
        alert_level: alertLevel,
      },
    }));
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle>Nova notificação</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Manutenção programada" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as NotificationType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="message">Mensagem</SelectItem>
                <SelectItem value="poll">Enquete</SelectItem>
                <SelectItem value="question">Pergunta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Público</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as NotificationAudience)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {isAdmin && <SelectItem value="all">Todos</SelectItem>}
                {isAdmin && <SelectItem value="owners">Donos de escritório</SelectItem>}
                <SelectItem value="teams">Equipe</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label>Tipo de Alerta</Label>
          <Select value={alertLevel} onValueChange={(v) => setAlertLevel(v as AlertLevel)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="info">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Informativo
                </span>
              </SelectItem>
              <SelectItem value="notice">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  Notificação
                </span>
              </SelectItem>
              <SelectItem value="alert">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
                  Alerta
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>{type === 'question' ? 'Enunciado da pergunta' : 'Mensagem'}</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[100px]"
            placeholder={type === 'question' ? 'O que você gostaria de perguntar?' : 'Conteúdo da mensagem'} />
        </div>

        {type === 'poll' && (
          <div className="space-y-2">
            <Label>Opções da enquete</Label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex gap-2">
                <Input value={opt} onChange={(e) => setOptions((p) => p.map((o, i) => (i === idx ? e.target.value : o)))}
                  placeholder={`Opção ${idx + 1}`} />
                {options.length > 2 && (
                  <Button variant="ghost" size="icon" onClick={() => setOptions((p) => p.filter((_, i) => i !== idx))}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setOptions((p) => [...p, ''])}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar opção
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <Label>Envio</Label>
          <div className="flex gap-2">
            <Button type="button" variant={when === 'now' ? 'default' : 'outline'} size="sm" onClick={() => setWhen('now')}>
              <Send className="w-4 h-4 mr-1" /> Agora
            </Button>
            <Button type="button" variant={when === 'schedule' ? 'default' : 'outline'} size="sm" onClick={() => setWhen('schedule')}>
              <Clock className="w-4 h-4 mr-1" /> Agendar
            </Button>
          </div>
          {when === 'schedule' && (
            <Input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="max-w-xs" />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleTest} disabled={saving}>
            Testar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Enviando…' : when === 'schedule' ? 'Agendar' : 'Enviar agora'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
