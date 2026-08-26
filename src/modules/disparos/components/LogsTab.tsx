import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDspQueues } from '../extend/queues';
import { useDspCampaigns } from '../hooks/useDspCampaigns';
import { useDspFailedRecipients, useDspLogs } from '../hooks/useDspLogs';

export function LogsTab({ clientId }: { clientId: string | null }) {
  const [campaignId, setCampaignId] = useState('all');
  const [queueId, setQueueId] = useState('all');
  const [days, setDays] = useState('7');

  const { data: campaigns = [] } = useDspCampaigns(clientId);
  const { data: queues = [] } = useDspQueues(clientId);
  const { data: logs = [] } = useDspLogs(clientId, {
    campaignId: campaignId === 'all' ? null : campaignId,
    queueId: queueId === 'all' ? null : queueId,
    days: Number(days),
  });
  const { data: failed = [] } = useDspFailedRecipients(clientId, campaignId === 'all' ? null : campaignId);

  const campaignName = (id: string | null) =>
    id ? campaigns.find((c) => c.id === id)?.name ?? id.slice(0, 8) : '—';
  const queueName = (id: string | null) =>
    id ? queues.find((q) => q.id === id)?.name ?? id.slice(0, 8) : '—';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] space-y-1.5">
          <Label>Campanha</Label>
          <Select value={campaignId} onValueChange={setCampaignId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px] space-y-1.5">
          <Label>Fila</Label>
          <Select value={queueId} onValueChange={setQueueId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {queues.map((q) => <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[140px] space-y-1.5">
          <Label>Período</Label>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Últimas 24h</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Eventos ({logs.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {logs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum log no período.</p>}
          {logs.map((l) => (
            <div key={l.id} className="rounded border p-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{l.action}</Badge>
                <span className="font-medium">{campaignName(l.campaign_id)}</span>
                {l.queue_id && <span className="text-muted-foreground">· {queueName(l.queue_id)}</span>}
                <span className="ml-auto text-muted-foreground">
                  {new Date(l.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
              {l.details && (
                <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">
                  {JSON.stringify(l.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Falhas por destinatário</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {failed.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma falha registrada.</p>}
          {failed.map((f: any) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2 rounded border px-2 py-1.5 text-xs">
              <span className="font-medium">{f.phone_e164}</span>
              <span className="text-muted-foreground">{f.name || '—'}</span>
              <span className="text-destructive">{f.error_message || f.exclusion_reason || 'erro'}</span>
              <span className="ml-auto text-muted-foreground">
                {f.attempts} tentativa(s) · {queueName(f.queue_id)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
