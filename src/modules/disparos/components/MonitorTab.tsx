import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ShieldCheck, ShieldAlert, ShieldX, Unlock, Clock } from 'lucide-react';
import { useDspQueues } from '../extend/queues';
import { useDspCampaigns } from '../hooks/useDspCampaigns';
import { useDspChannelStates, useDspQueueCounts, useDspQueueItems } from '../hooks/useDspMonitor';
import { useClearChannelCooldown } from '../hooks/useDspLimits';
import { HEALTH_LABEL } from '../module';

function healthIcon(status: string) {
  if (status === 'blocked') return <ShieldX className="h-4 w-4 text-destructive" />;
  if (status === 'degraded') return <ShieldAlert className="h-4 w-4 text-amber-500" />;
  return <ShieldCheck className="h-4 w-4 text-emerald-500" />;
}

function relative(ts: string | null) {
  if (!ts) return '—';
  const diff = new Date(ts).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const label = mins < 1 ? 'menos de 1 min' : mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} h`;
  return diff > 0 ? `em ${label}` : `há ${label}`;
}

export function MonitorTab({ clientId, canEdit }: { clientId: string | null; canEdit: boolean }) {
  const [campaignId, setCampaignId] = useState<string>('all');
  const selected = campaignId === 'all' ? null : campaignId;

  const { data: campaigns = [] } = useDspCampaigns(clientId);
  const { data: queues = [] } = useDspQueues(clientId);
  const { data: states = [] } = useDspChannelStates(clientId);
  const { data: counts } = useDspQueueCounts(clientId, selected);
  const { data: items = [] } = useDspQueueItems(clientId, selected);
  const clearCooldown = useClearChannelCooldown();

  const queueName = (id: string) => queues.find((q) => q.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[240px] space-y-1.5">
          <Label>Campanha</Label>
          <Select value={campaignId} onValueChange={setCampaignId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as campanhas</SelectItem>
              {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ['Na fila', counts?.pending ?? 0],
          ['Processando', counts?.processing ?? 0],
          ['Enviadas', counts?.sent ?? 0],
          ['Falhas', counts?.failed ?? 0],
          ['Canceladas', counts?.cancelled ?? 0],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-semibold">{value as number}</div>
              <div className="text-xs text-muted-foreground">{label as string}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Filas — limites, circuit breaker e timers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {states.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma fila com estado registrado ainda.</p>
          )}
          <TooltipProvider>
            {states.map((s) => {
              const inCooldown = s.cooldown_until && new Date(s.cooldown_until) > new Date();
              return (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {healthIcon(s.health_status)}
                      {queueName(s.queue_id)}
                      <Badge variant={s.health_status === 'healthy' ? 'secondary' : 'destructive'} className="text-[10px]">
                        {HEALTH_LABEL[s.health_status] ?? s.health_status}
                      </Badge>
                      {inCooldown && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <Clock className="h-3 w-3" /> Cooldown {relative(s.cooldown_until)}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>{s.cooldown_reason || 'Pausa de segurança'}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>Minuto: {s.sent_in_minute}</span>
                      <span>Hora: {s.sent_in_hour}</span>
                      <span>Dia: {s.sent_in_day}{s.allowed_today ? ` / ${s.allowed_today}` : ''}</span>
                      <span>Únicos hoje: {s.unique_recipients_day}</span>
                      <span>Bloco: {s.block_count}</span>
                      <span className={s.consecutive_failures > 0 ? 'text-destructive' : ''}>
                        Falhas seguidas: {s.consecutive_failures}
                      </span>
                      <span>Último envio: {relative(s.last_sent_at)}</span>
                      <span>Próximo permitido: {relative(s.next_allowed_at)}</span>
                    </div>
                  </div>
                  {canEdit && (inCooldown || s.health_status !== 'healthy') && (
                    <Button
                      size="sm" variant="outline" className="gap-1"
                      onClick={() => clearCooldown.mutate(s.queue_id)}
                    >
                      <Unlock className="h-3.5 w-3.5" /> Liberar
                    </Button>
                  )}
                </div>
              );
            })}
          </TooltipProvider>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Próximas mensagens na fila</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {items.filter((i) => ['pending', 'processing'].includes(i.status)).slice(0, 25).map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs">
              <span className="flex items-center gap-2">
                <Badge variant={i.status === 'processing' ? 'default' : 'outline'} className="text-[10px]">
                  {i.status === 'processing' ? 'Processando' : 'Na fila'}
                </Badge>
                Disponível {relative(i.available_at)}
              </span>
              <span className="text-muted-foreground">
                Tentativas: {i.attempts}{i.last_error ? ` · ${i.last_error.slice(0, 60)}` : ''}
              </span>
            </div>
          ))}
          {items.filter((i) => ['pending', 'processing'].includes(i.status)).length === 0 && (
            <p className="text-sm text-muted-foreground">Nada pendente na fila.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
