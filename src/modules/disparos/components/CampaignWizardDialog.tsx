import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../extend/auth';
import { useDspQueues, isUnofficialQueue } from '../extend/queues';
import { useDspChannelLimits } from '../hooks/useDspMonitor';

import { useSaveDspCampaign, useDspCampaignVariants, useDspCampaignChannels } from '../hooks/useDspCampaigns';
import { useDspSimulation } from '../hooks/useDspSimulation';
import { EXCLUSION_REASON_LABEL, CHANNEL_REASON_LABEL, DISPAROS_TIMEZONES } from '../module';
import { useDspTemplates } from '../hooks/useDspTemplates';
import type { DspCampaign } from '../types';

const WEEK_DAYS = [
  { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' }, { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' }, { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

/** ISO -> valor aceito por <input type="datetime-local"> no fuso do navegador. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string | null;
  campaign: DspCampaign | null;
}

export function CampaignWizardDialog({ open, onOpenChange, clientId, campaign }: Props) {
  const { user } = useAuth();
  const { data: allQueues = [] } = useDspQueues(clientId);
  const { data: channelLimits = [] } = useDspChannelLimits(clientId);
  const enabledQueueIds = new Set(
    channelLimits.filter((l) => l.is_enabled === true).map((l) => l.queue_id),
  );
  const queues = allQueues.filter((q) => enabledQueueIds.has(q.id));

  const save = useSaveDspCampaign();
  const simulate = useDspSimulation();
  const { data: existingVariants = [] } = useDspCampaignVariants(open ? campaign?.id ?? null : null);
  const { data: existingChannels = [] } = useDspCampaignChannels(open ? campaign?.id ?? null : null);
  const { data: approvedTemplates = [] } = useDspTemplates(clientId, true);

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [category, setCategory] = useState('marketing');
  const [strategy, setStrategy] = useState('auto');
  const [windowStart, setWindowStart] = useState('08:00');
  const [windowEnd, setWindowEnd] = useState('20:00');
  const [weekDays, setWeekDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [scheduleEndAt, setScheduleEndAt] = useState('');
  const [autoWindowControl, setAutoWindowControl] = useState(true);

  const [manualPhones, setManualPhones] = useState('');
  const [lastDays, setLastDays] = useState('');
  const [audienceLimit, setAudienceLimit] = useState('');
  const [audienceMode, setAudienceMode] = useState<'list' | 'audience'>('list');
  const [audienceId, setAudienceId] = useState<string>('');
  const [onlyWithConversation, setOnlyWithConversation] = useState(false);

  const [variants, setVariants] = useState<{ label: string; message_text: string; weight: number; template_id?: string | null }[]>([
    { label: 'Variante A', message_text: '', weight: 1 },
  ]);
  const [selectedQueues, setSelectedQueues] = useState<string[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSavedId(campaign?.id ?? null);
    setName(campaign?.name ?? '');
    setGoal(campaign?.goal ?? '');
    setCategory(campaign?.category ?? 'marketing');
    setStrategy(campaign?.channel_strategy ?? 'auto');
    setWindowStart(campaign?.send_window_start?.slice(0, 5) ?? '08:00');
    setWindowEnd(campaign?.send_window_end?.slice(0, 5) ?? '20:00');
    setWeekDays(campaign?.send_week_days ?? [1, 2, 3, 4, 5]);
    setScheduledAt(
      campaign?.schedule_start_at
        ? toLocalInput(campaign.schedule_start_at)
        : campaign?.scheduled_at ? toLocalInput(campaign.scheduled_at) : '',
    );
    setScheduleEndAt(campaign?.schedule_end_at ? toLocalInput(campaign.schedule_end_at) : '');
    setTimezone(campaign?.timezone ?? 'America/Sao_Paulo');
    setAutoWindowControl(campaign?.auto_window_control ?? true);
    setAudienceMode((campaign?.audience_mode as any) === 'audience' ? 'audience' : 'list');
    setAudienceId(campaign?.audience_id ?? '');
    const f = campaign?.audience_filters ?? {};
    setManualPhones((f.manual_phones ?? []).join('\n'));
    setLastDays(f.last_interaction_days != null ? String(f.last_interaction_days) : '');
    setAudienceLimit(f.limit != null ? String(f.limit) : '');
    setOnlyWithConversation(!!f.only_with_conversation);
    simulate.reset();
  }, [open, campaign?.id]);

  useEffect(() => {
    if (open && existingVariants.length > 0) {
      setVariants(existingVariants.map((v) => ({ label: v.label, message_text: v.message_text ?? '', weight: v.weight })));
    }
  }, [open, existingVariants.length]);

  useEffect(() => {
    if (open && existingChannels.length > 0) {
      setSelectedQueues(existingChannels.map((c) => c.queue_id));
    }
  }, [open, existingChannels.length]);

  const buildPayload = () => ({
    id: savedId ?? undefined,
    client_id: String(clientId),
    name: name.trim(),
    goal: goal.trim() || null,
    category,
    channel_strategy: strategy,
    audience_filters: {
      manual_phones: manualPhones.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean),
      last_interaction_days: lastDays ? Number(lastDays) : null,
      only_with_conversation: onlyWithConversation,
      limit: audienceLimit ? Number(audienceLimit) : null,
    },
    audience_mode: audienceMode,
    audience_id: audienceMode === 'audience' ? (audienceId || null) : null,
    send_window_start: windowStart,
    send_window_end: windowEnd,
    send_week_days: weekDays,
    scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    schedule_start_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    schedule_end_at: scheduleEndAt ? new Date(scheduleEndAt).toISOString() : null,
    timezone,
    auto_window_control: autoWindowControl,
    created_by: user?.id != null ? String(user.id) : null,
    variants: variants.filter((v) => v.message_text.trim()),
    channels: selectedQueues.map((q) => ({ queue_id: q, weight: 1 })),
  });

  const handleSaveAndSimulate = async () => {
    const id = await save.mutateAsync(buildPayload());
    setSavedId(id);
    setStep(4);
    simulate.mutate({ campaign_id: id });
  };

  const handleFinish = async () => {
    await save.mutateAsync(buildPayload());
    onOpenChange(false);
  };

  const canGoStep2 = name.trim().length > 2;
  const canGoStep3 = variants.some((v) => v.message_text.trim());
  const canSimulate = selectedQueues.length > 0 && canGoStep3;
  const unofficialSelected = queues.filter((q) => selectedQueues.includes(q.id) && isUnofficialQueue(q));
  const sim = simulate.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? 'Editar campanha' : 'Nova campanha'} — passo {step} de 4</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome da campanha</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Reativação junho" />
            </div>
            <div className="space-y-1.5">
              <Label>Objetivo</Label>
              <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="O que essa campanha busca?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="utility">Utilidade / serviço</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <Select value={strategy} onValueChange={setStrategy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automático</SelectItem>
                    <SelectItem value="official">Somente API Oficial</SelectItem>
                    <SelectItem value="unofficial">Somente UaZapi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Janela de envio — início</Label>
                <Input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Janela de envio — fim</Label>
                <Input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Dias da semana</Label>
              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map((d) => (
                  <Badge
                    key={d.value}
                    variant={weekDays.includes(d.value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() =>
                      setWeekDays((prev) =>
                        prev.includes(d.value) ? prev.filter((x) => x !== d.value) : [...prev, d.value])
                    }
                  >
                    {d.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Fuso horário do cronograma</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISPAROS_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A janela de horário e os dias da semana são avaliados neste fuso.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início do cronograma (opcional)</Label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim do cronograma (opcional)</Label>
                <Input type="datetime-local" value={scheduleEndAt} onChange={(e) => setScheduleEndAt(e.target.value)} />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={autoWindowControl} onCheckedChange={(v) => setAutoWindowControl(!!v)} />
              <span>
                Pausar e retomar automaticamente conforme a janela
                <span className="block text-xs text-muted-foreground">
                  O sistema pausa ao sair do horário/dia permitido e retoma sozinho quando a janela reabre.
                </span>
              </span>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid gap-2 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setAudienceMode('list')}
                className={`rounded-lg border p-3 text-left text-sm transition ${audienceMode === 'list' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
              >
                <p className="font-medium">Lista/filtros desta campanha</p>
                <p className="text-xs text-muted-foreground">Telefones colados e filtros de contatos.</p>
              </button>
              <button
                type="button"
                onClick={() => setAudienceMode('audience')}
                className={`rounded-lg border p-3 text-left text-sm transition ${audienceMode === 'audience' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
              >
                <p className="font-medium">Usar público já criado</p>
                <p className="text-xs text-muted-foreground">Grupos salvos na aba Público.</p>
              </button>
            </div>

            {audienceMode === 'audience' ? (
              <div className="space-y-1.5">
                <Label>Público</Label>
                <Select value={audienceId} onValueChange={setAudienceId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um público" /></SelectTrigger>
                  <SelectContent>
                    {audiences.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} — {a.total_active} contato(s)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {audiences.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum público ativo. Crie um na aba Público.</p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Telefones manuais / CSV colado</Label>
                  <Textarea
                    rows={5}
                    value={manualPhones}
                    onChange={(e) => setManualPhones(e.target.value)}
                    placeholder={'5511999998888\n5511988887777'}
                  />
                  <p className="text-xs text-muted-foreground">
                    Um por linha. Deixe vazio para usar somente os filtros de contatos.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Última interação (dias)</Label>
                    <Input value={lastDays} onChange={(e) => setLastDays(e.target.value)} placeholder="Ex.: 30" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Limite de público</Label>
                    <Input value={audienceLimit} onChange={(e) => setAudienceLimit(e.target.value)} placeholder="Ex.: 500" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={onlyWithConversation} onCheckedChange={(v) => setOnlyWithConversation(!!v)} />
                  Somente contatos que já conversaram
                </label>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              {approvedTemplates.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Usar template aprovado</Label>
                  <Select
                    value=""
                    onValueChange={(id) => {
                      const t = approvedTemplates.find((x) => x.id === id);
                      if (!t) return;
                      setVariants((prev) => [
                        ...prev.filter((v) => v.message_text.trim()),
                        { label: t.name, message_text: t.body, weight: 1, template_id: t.id },
                      ]);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecionar template..." /></SelectTrigger>
                    <SelectContent>
                      {approvedTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label>Variantes de mensagem (rotação)</Label>
                <Button
                  size="sm" variant="outline" className="gap-1"
                  onClick={() => setVariants((v) => [...v, { label: `Variante ${String.fromCharCode(65 + v.length)}`, message_text: '', weight: 1 }])}
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>
              {variants.map((v, i) => (
                <Card key={i}>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-8"
                        value={v.label}
                        onChange={(e) => setVariants((prev) => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                      />
                      <Button
                        size="icon" variant="ghost" className="h-8 w-8"
                        onClick={() => setVariants((prev) => prev.filter((_, j) => j !== i))}
                        disabled={variants.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Textarea
                      rows={3}
                      placeholder="Olá {{nome}}, ..."
                      value={v.message_text}
                      onChange={(e) => setVariants((prev) => prev.map((x, j) => j === i ? { ...x, message_text: e.target.value } : x))}
                    />
                  </CardContent>
                </Card>
              ))}
              <p className="text-xs text-muted-foreground">
                Variáveis: <code>{'{{nome}}'}</code>, <code>{'{{primeiro_nome}}'}</code>, <code>{'{{telefone}}'}</code>.
                Duas ou mais variantes reduzem o risco de bloqueio.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Filas que vão disparar (rotação de números)</Label>
              {queues.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum canal habilitado. Habilite uma fila na aba <b>Canais</b> antes de criar a campanha.
                </p>
              )}

              {queues.map((q) => (
                <label key={q.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedQueues.includes(q.id)}
                    onCheckedChange={(v) =>
                      setSelectedQueues((prev) => v ? [...prev, q.id] : prev.filter((x) => x !== q.id))
                    }
                  />
                  <span>{q.name}</span>
                  <Badge variant={isUnofficialQueue(q) ? 'destructive' : 'secondary'} className="text-[10px]">
                    {isUnofficialQueue(q) ? 'Não oficial' : 'Oficial'}
                  </Badge>
                  {!q.is_active && <Badge variant="outline" className="text-[10px]">Inativa</Badge>}
                </label>
              ))}
              {unofficialSelected.length === 1 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-600" />
                  Apenas uma fila não oficial selecionada. Adicione mais números para diluir o volume.
                </div>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            {simulate.isPending && (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Simulando elegibilidade e supressões...
              </div>
            )}
            {sim && (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[
                    ['Total', sim.stats.total],
                    ['Elegíveis', sim.stats.eligible],
                    ['Suprimidos', sim.stats.suppressed],
                    ['Inválidos', sim.stats.invalid],
                    ['Frequência', sim.stats.frequency],
                  ].map(([label, value]) => (
                    <Card key={String(label)}>
                      <CardContent className="py-3 text-center">
                        <div className="text-lg font-semibold">{value as number}</div>
                        <div className="text-[11px] text-muted-foreground">{label as string}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {sim.capacity && (
                  <Card>
                    <CardContent className="py-3 space-y-1 text-sm">
                      <div>Capacidade diária: <b>{sim.capacity.daily_capacity}</b> mensagens em {sim.capacity.queues} fila(s)</div>
                      <div className="text-muted-foreground text-xs">
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
                  <div className="space-y-1">
                    <Label className="text-xs">Prévia</Label>
                    {sim.preview.map((p, i) => (
                      <div key={i} className="rounded-md border bg-muted/40 p-2 text-xs">
                        <div className="font-medium">{p.phone}</div>
                        <div className="whitespace-pre-wrap text-muted-foreground">{p.text || '—'}</div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Motivos de exclusão possíveis: {Object.values(EXCLUSION_REASON_LABEL).join(' · ')}. Nada foi enviado nesta simulação.
                </p>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>Voltar</Button>}
          {step === 1 && <Button disabled={!canGoStep2} onClick={() => setStep(2)}>Continuar</Button>}
          {step === 2 && (
            <Button disabled={audienceMode === 'audience' && !audienceId} onClick={() => setStep(3)}>Continuar</Button>
          )}
          {step === 3 && (
            <Button disabled={!canSimulate || save.isPending} onClick={handleSaveAndSimulate}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar e simular
            </Button>
          )}
          {step === 4 && (
            <Button onClick={handleFinish} disabled={save.isPending}>Concluir</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
