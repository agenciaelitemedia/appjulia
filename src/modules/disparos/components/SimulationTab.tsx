import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FlaskConical } from 'lucide-react';
import { useDspCampaigns } from '../hooks/useDspCampaigns';
import { useDspSimulation } from '../hooks/useDspSimulation';
import { CHANNEL_REASON_LABEL } from '../module';

export function SimulationTab({ clientId }: { clientId: string | null }) {
  const { data: campaigns = [] } = useDspCampaigns(clientId);
  const simulate = useDspSimulation();
  const [campaignId, setCampaignId] = useState<string>('');

  const sim = simulate.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Simulação de disparo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Roda a elegibilidade, as supressões e o limite de frequência sem enfileirar nem enviar
            nada, gerando o relatório do que seria disparado.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1 space-y-1.5">
              <Label>Campanha</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma campanha" /></SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="gap-2"
              disabled={!campaignId || simulate.isPending}
              onClick={() => simulate.mutate({ campaign_id: campaignId })}
            >
              {simulate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Simular
            </Button>
          </div>
        </CardContent>
      </Card>

      {sim && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ['Total', sim.stats.total],
              ['Elegíveis', sim.stats.eligible],
              ['Suprimidos', sim.stats.suppressed],
              ['Inválidos', sim.stats.invalid],
              ['Frequência', sim.stats.frequency],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <CardContent className="py-4 text-center">
                  <div className="text-2xl font-semibold">{value as number}</div>
                  <div className="text-xs text-muted-foreground">{label as string}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {sim.capacity && (
            <Card>
              <CardContent className="py-4 space-y-1 text-sm">
                <div>
                  Capacidade diária restante: <b>{sim.capacity.daily_capacity}</b> mensagens
                  em {sim.capacity.queues} fila(s)
                </div>
                <div className="text-xs text-muted-foreground">
                  Duração estimada: {sim.capacity.estimated_days} dia(s) · ~{sim.capacity.estimated_minutes} min de envio efetivo
                </div>
                {(sim.capacity.blocking ?? []).length > 0 && (
                  <div className="text-xs text-amber-600">
                    Bloqueios agora: {(sim.capacity.blocking ?? []).map((b) => {
                      const reason = b.split(':').slice(1).join(':');
                      return CHANNEL_REASON_LABEL[reason] ?? reason;
                    }).join(', ')}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {sim.preview?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Prévia das mensagens</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {sim.preview.map((p, i) => (
                  <div key={i} className="rounded-md border bg-muted/40 p-2 text-xs">
                    <div className="font-medium">{p.phone}</div>
                    <div className="whitespace-pre-wrap text-muted-foreground">{p.text || '—'}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
